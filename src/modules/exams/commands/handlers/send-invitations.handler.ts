import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { SendInvitationsCommand } from '../impl/send-invitations.command';
import { Exam, ExamAccessMode } from '../../schemas/exam.schema';
import { ExamInvitation, InvitationStatus } from '../../schemas/exam-invitation.schema';
import { InvitationTokenService } from '../../services/invitation-token.service';
import { EmailService } from '../../../email/services/email.service';

interface InvitationResult {
  email: string;
  name: string;
  status: 'sent' | 'failed' | 'duplicate';
  invitationToken?: string;
  invitationUrl?: string;
  expiresAt?: Date;
  error?: string;
}

@CommandHandler(SendInvitationsCommand)
export class SendInvitationsHandler
  implements ICommandHandler<SendInvitationsCommand>
{
  private readonly logger = new Logger(SendInvitationsHandler.name);

  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<Exam>,
    @InjectModel(ExamInvitation.name)
    private readonly invitationModel: Model<ExamInvitation>,
    private readonly invitationTokenService: InvitationTokenService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: SendInvitationsCommand) {
    const { examId, sendInvitationsDto, userId } = command;
    const { candidates, invitationNote, customMessage, validityDays } =
      sendInvitationsDto;

    // Find exam
    const exam = await this.examModel.findById(examId);
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // Verify exam access mode allows invitations
    if (
      exam.accessMode !== ExamAccessMode.INVITATION_BASED &&
      exam.accessMode !== ExamAccessMode.HYBRID
    ) {
      throw new BadRequestException(
        `This exam does not support invitation-based access. Current mode: ${exam.accessMode}`
      );
    }

    // Verify user has permission (exam creator or org admin)
    // Note: Role-based guards should handle this, but double-check here
    if (exam.createdBy.toString() !== userId) {
      // Could add additional org admin check here if needed
      this.logger.warn(
        `User ${userId} attempting to send invitations for exam created by ${exam.createdBy}`
      );
    }

    // Determine validity days (use provided value or exam default or system default)
    const linkValidityDays =
      validityDays ||
      exam.invitationSettings?.linkValidityDays ||
      7;

    // Calculate expiry date
    const expiresAt =
      this.invitationTokenService.calculateExpiry(linkValidityDays);

    // Process each candidate
    const results: InvitationResult[] = [];
    const emailsToSend: any[] = [];

    for (const candidate of candidates) {
      try {
        const email = candidate.email.toLowerCase();

        // Check for duplicate invitation
        const existingInvitation =
          await this.invitationTokenService.checkDuplicateInvitation(
            examId,
            email
          );

        if (existingInvitation) {
          // Log server-side (don't reveal to client that email exists)
          this.logger.warn(
            `Duplicate invitation attempt for email: ${email}, exam: ${examId}. ` +
            `Existing invitation: ${existingInvitation.invitationToken}`
          );

          // Return generic success status to prevent email enumeration
          // Actual duplicate email will not be sent, but response doesn't reveal this
          results.push({
            email: candidate.email,
            name: candidate.name,
            status: 'sent', // Changed from 'duplicate' to prevent enumeration
            // Don't include token/URL/expiresAt to prevent info leakage
          });
          continue;
        }

        // Generate unique token
        const token = this.invitationTokenService.generateToken();

        // Create invitation
        const invitation = new this.invitationModel({
          invitationToken: token,
          examId: exam._id,
          organizationId: exam.organizationId,
          candidateEmail: email,
          candidateName: candidate.name,
          candidatePhone: candidate.phone,
          status: InvitationStatus.PENDING,
          expiresAt,
          accessCount: 0,
          invitedBy: userId,
          invitationNote,
        });

        await invitation.save();

        const invitationUrl = this.buildInvitationUrl(token);

        results.push({
          email: candidate.email,
          name: candidate.name,
          status: 'sent',
          invitationToken: token,
          invitationUrl,
          expiresAt,
        });

        // Queue email
        emailsToSend.push({
          candidateName: candidate.name,
          candidateEmail: email,
          examTitle: exam.title,
          examDescription: exam.description,
          examDuration: exam.duration,
          invitationUrl,
          expiresAt,
          invitationNote: invitationNote || '',
          customMessage: customMessage || '',
        });
      } catch (error) {
        this.logger.error('Error creating invitation:', {
          email: candidate.email,
          error: error.message,
          stack: error.stack,
        });

        results.push({
          email: candidate.email,
          name: candidate.name,
          status: 'failed',
          error: error.message || 'Unknown error',
        });
      }
    }

    // Send invitation emails
    if (emailsToSend.length > 0) {
      try {
        await this.emailService.queueBulkExamInvitations(emailsToSend);
        this.logger.log(
          `Queued ${emailsToSend.length} invitation emails for exam ${exam.title}`
        );
      } catch (error) {
        this.logger.error('Failed to send invitation emails:', error);
        // Don't fail the command, invitations are created
      }
    }

    // Summary (generic to prevent email enumeration)
    const summary = {
      total: candidates.length,
      sent: results.filter((r) => r.status === 'sent').length,
      failed: results.filter((r) => r.status === 'failed').length,
      // Removed duplicate count to prevent enumeration
      emailsQueued: emailsToSend.length,
    };

    // Log actual duplicate count server-side only
    const duplicateCount = results.length - emailsToSend.length - summary.failed;
    if (duplicateCount > 0) {
      this.logger.log(
        `Processed ${candidates.length} invitations: ` +
        `${emailsToSend.length} new, ${duplicateCount} duplicates, ${summary.failed} failed`
      );
    }

    return {
      success: true,
      message: 'Invitations processed successfully',
      summary,
      // Remove details from response in production to prevent enumeration
      details: process.env.NODE_ENV === 'development' ? results : undefined,
    };
  }

  private buildInvitationUrl(token: string): string {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    return `${frontendUrl}/exam/invitation/${token}`;
  }
}
