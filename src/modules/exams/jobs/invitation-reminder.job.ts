import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InvitationTokenService } from '../services/invitation-token.service';
import { EmailService } from '../../email/services/email.service';
import { ExamInvitation, InvitationStatus } from '../schemas/exam-invitation.schema';
import { ConfigService } from '@nestjs/config';

/**
 * Background job to send reminder emails to candidates before their invitation expires
 *
 * Runs daily to check for invitations expiring within 24 hours
 */
@Injectable()
export class InvitationReminderJob {
  private readonly logger = new Logger(InvitationReminderJob.name);

  constructor(
    @InjectModel(ExamInvitation.name)
    private readonly invitationModel: Model<ExamInvitation>,
    private readonly invitationTokenService: InvitationTokenService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Run daily at 9 AM UTC
   * Can be customized using cron expression:
   * - '0 9 * * *' = Daily at 9 AM
   * - '0 0 * * *' = Daily at midnight
   * - '0 9,15 * * *' = Daily at 9 AM and 3 PM
   */
  @Cron('0 9 * * *', {
    name: 'invitation-reminder',
    timeZone: 'UTC',
  })
  async handleInvitationReminders() {
    this.logger.log('Starting invitation reminder job...');

    try {
      // Get invitations expiring within 24 hours
      const expiringInvitations =
        await this.invitationTokenService.getExpiringInvitations(24);

      if (expiringInvitations.length === 0) {
        this.logger.log('No invitations expiring soon');
        return;
      }

      this.logger.log(
        `Found ${expiringInvitations.length} invitation(s) expiring within 24 hours`
      );

      // Process each invitation
      let remindersSent = 0;
      let remindersFailed = 0;

      for (const invitation of expiringInvitations) {
        try {
          // Check if exam has reminder emails enabled
          const exam = invitation.examId as any;
          if (
            exam.invitationSettings &&
            !exam.invitationSettings.sendReminderEmails
          ) {
            this.logger.log(
              `Skipping reminder for ${invitation.candidateEmail} - reminders disabled for exam`
            );
            continue;
          }

          // Build invitation URL
          const frontendUrl =
            this.configService.get<string>('FRONTEND_URL') ||
            'http://localhost:3000';
          const invitationUrl = `${frontendUrl}/exam/invitation/${invitation.invitationToken}`;

          // Calculate hours until expiry
          const now = new Date();
          const hoursUntilExpiry = Math.round(
            (invitation.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)
          );

          // Send reminder email
          await this.emailService.sendInvitationReminderEmail({
            candidateName: invitation.candidateName,
            candidateEmail: invitation.candidateEmail,
            examTitle: exam.title,
            invitationUrl,
            invitationToken: invitation.invitationToken,
            expiresAt: invitation.expiresAt,
            hoursUntilExpiry,
          });

          remindersSent++;
          this.logger.log(
            `Sent reminder to ${invitation.candidateEmail} (expires in ${hoursUntilExpiry}h)`
          );
        } catch (error) {
          remindersFailed++;
          this.logger.error(
            `Failed to send reminder to ${invitation.candidateEmail}:`,
            {
              error: error.message,
              stack: error.stack,
            }
          );
        }
      }

      this.logger.log(
        `Invitation reminder job completed: ${remindersSent} sent, ${remindersFailed} failed`
      );
    } catch (error) {
      this.logger.error('Error in invitation reminder job:', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Manual trigger for sending reminders
   * Can be called by admin endpoint
   */
  async manualTrigger(hoursBeforeExpiry: number = 24): Promise<{
    sent: number;
    failed: number;
  }> {
    this.logger.log(
      `Manual trigger: Sending reminders for invitations expiring within ${hoursBeforeExpiry} hours...`
    );

    const expiringInvitations =
      await this.invitationTokenService.getExpiringInvitations(
        hoursBeforeExpiry
      );

    let sent = 0;
    let failed = 0;

    for (const invitation of expiringInvitations) {
      try {
        const exam = invitation.examId as any;
        const frontendUrl =
          this.configService.get<string>('FRONTEND_URL') ||
          'http://localhost:3000';
        const invitationUrl = `${frontendUrl}/exam/invitation/${invitation.invitationToken}`;

        const now = new Date();
        const hoursUntilExpiry = Math.round(
          (invitation.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)
        );

        await this.emailService.sendInvitationReminderEmail({
          candidateName: invitation.candidateName,
          candidateEmail: invitation.candidateEmail,
          examTitle: exam.title,
          invitationUrl,
          invitationToken: invitation.invitationToken,
          expiresAt: invitation.expiresAt,
          hoursUntilExpiry,
        });

        sent++;
      } catch (error) {
        failed++;
        this.logger.error(
          `Failed to send reminder to ${invitation.candidateEmail}:`,
          error
        );
      }
    }

    this.logger.log(
      `Manual reminder trigger completed: ${sent} sent, ${failed} failed`
    );
    return { sent, failed };
  }
}
