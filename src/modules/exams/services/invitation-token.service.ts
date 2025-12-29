import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ExamInvitation, InvitationStatus } from '../schemas/exam-invitation.schema';

@Injectable()
export class InvitationTokenService {
  private readonly logger = new Logger(InvitationTokenService.name);

  // UUID v4 format regex for validation
  private readonly UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(
    @InjectModel(ExamInvitation.name)
    private readonly invitationModel: Model<ExamInvitation>,
  ) {}

  /**
   * Generate a cryptographically secure unique token (UUID v4)
   * Uses crypto.randomUUID if available (Node 14.17+), otherwise falls back to uuid library
   */
  generateToken(): string {
    try {
      // Prefer native crypto.randomUUID (Node 14.17+)
      if (typeof randomUUID === 'function') {
        const token = randomUUID();
        this.validateTokenFormat(token);
        return token;
      }
    } catch (error) {
      this.logger.warn('crypto.randomUUID failed, falling back to uuid library', error);
    }

    // Fallback to uuid library with crypto.randomBytes for maximum security
    const token = uuidv4({
      random: randomBytes(16),
    });

    this.validateTokenFormat(token);
    return token;
  }

  /**
   * Validate that a token matches UUID v4 format
   * @param token The token to validate
   * @throws BadRequestException if format is invalid
   */
  validateTokenFormat(token: string): boolean {
    if (!this.UUID_V4_REGEX.test(token)) {
      throw new BadRequestException('Invalid token format');
    }
    return true;
  }

  /**
   * Calculate expiry date based on validity days
   * @param validityDays Number of days until token expires (default: 7)
   */
  calculateExpiry(validityDays: number = 7): Date {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + validityDays);
    return expiryDate;
  }

  /**
   * Validate an invitation token and return the invitation if valid
   * @param token The invitation token to validate
   * @throws NotFoundException if token doesn't exist
   * @throws BadRequestException if token is expired, revoked, or already completed
   */
  async validateToken(token: string): Promise<ExamInvitation> {
    // Find invitation by token
    const invitation = await this.invitationModel
      .findOne({ invitationToken: token })
      .populate('examId')
      .exec();

    if (!invitation) {
      throw new NotFoundException('Invalid invitation token');
    }

    // Check if invitation is expired by status
    if (invitation.status === InvitationStatus.EXPIRED) {
      throw new BadRequestException('This invitation has expired');
    }

    // Check if invitation is revoked
    if (invitation.status === InvitationStatus.REVOKED) {
      throw new BadRequestException(
        invitation.revocationReason || 'This invitation has been revoked'
      );
    }

    // Check if invitation is already completed
    if (invitation.status === InvitationStatus.COMPLETED) {
      throw new BadRequestException('This invitation has already been used');
    }

    // Check if invitation is expired by date
    const now = new Date();
    if (invitation.expiresAt < now) {
      // Update status to expired
      invitation.status = InvitationStatus.EXPIRED;
      await invitation.save();

      throw new BadRequestException(
        `This invitation expired on ${invitation.expiresAt.toLocaleDateString()}`
      );
    }

    return invitation;
  }

  /**
   * Validate token and increment access count
   * @param token The invitation token
   * @param maxAccessCount Maximum allowed access count (optional)
   */
  async validateAndTrackAccess(
    token: string,
    maxAccessCount?: number,
  ): Promise<ExamInvitation> {
    const invitation = await this.validateToken(token);

    // Check if max access count exceeded
    if (maxAccessCount && invitation.accessCount >= maxAccessCount) {
      throw new BadRequestException(
        'This invitation link has been accessed too many times'
      );
    }

    // Increment access count
    invitation.accessCount += 1;

    // Set first accessed time if not already set
    if (!invitation.firstAccessedAt) {
      invitation.firstAccessedAt = new Date();
    }

    // Update status to ACCESSED if still PENDING
    if (invitation.status === InvitationStatus.PENDING) {
      invitation.status = InvitationStatus.ACCESSED;
    }

    await invitation.save();

    return invitation;
  }

  /**
   * Mark invitation as started (exam has begun)
   */
  async markAsStarted(
    invitationId: string,
    sessionId: string,
  ): Promise<ExamInvitation> {
    const invitation = await this.invitationModel.findById(invitationId);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    invitation.status = InvitationStatus.STARTED;
    invitation.examStartedAt = new Date();
    invitation.sessionId = sessionId as any;

    await invitation.save();

    return invitation;
  }

  /**
   * Mark invitation as completed (exam has been submitted)
   */
  async markAsCompleted(
    invitationId: string,
    resultId: string,
    autoExpire: boolean = false,
  ): Promise<ExamInvitation> {
    const invitation = await this.invitationModel.findById(invitationId);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    invitation.status = autoExpire
      ? InvitationStatus.EXPIRED
      : InvitationStatus.COMPLETED;
    invitation.examCompletedAt = new Date();
    invitation.resultId = resultId as any;

    await invitation.save();

    return invitation;
  }

  /**
   * Revoke an invitation
   */
  async revokeInvitation(
    invitationId: string,
    revokedBy: string,
    reason?: string,
  ): Promise<ExamInvitation> {
    const invitation = await this.invitationModel.findById(invitationId);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status === InvitationStatus.COMPLETED) {
      throw new BadRequestException('Cannot revoke a completed invitation');
    }

    invitation.status = InvitationStatus.REVOKED;
    invitation.revokedAt = new Date();
    invitation.revokedBy = revokedBy as any;
    invitation.revocationReason = reason;

    await invitation.save();

    return invitation;
  }

  /**
   * Get invitation by ID
   */
  async getInvitationById(invitationId: string): Promise<ExamInvitation> {
    const invitation = await this.invitationModel
      .findById(invitationId)
      .populate('examId')
      .populate('invitedBy', 'name email')
      .exec();

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }

  /**
   * Get invitations by exam ID
   */
  async getInvitationsByExam(
    examId: string,
    status?: InvitationStatus,
  ): Promise<ExamInvitation[]> {
    const filter: any = { examId };

    if (status) {
      filter.status = status;
    }

    return this.invitationModel
      .find(filter)
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Check if email already has pending invitation for exam
   */
  async checkDuplicateInvitation(
    examId: string,
    email: string,
  ): Promise<ExamInvitation | null> {
    return this.invitationModel
      .findOne({
        examId,
        candidateEmail: email.toLowerCase(),
        status: { $in: [InvitationStatus.PENDING, InvitationStatus.ACCESSED] },
      })
      .exec();
  }

  /**
   * Expire all invitations that are past their expiry date
   * Used by background job
   */
  async expireExpiredInvitations(): Promise<number> {
    const now = new Date();

    const result = await this.invitationModel.updateMany(
      {
        status: { $in: [InvitationStatus.PENDING, InvitationStatus.ACCESSED] },
        expiresAt: { $lt: now },
      },
      {
        $set: { status: InvitationStatus.EXPIRED },
      }
    );

    return result.modifiedCount;
  }

  /**
   * Get invitations expiring soon (for reminder emails)
   */
  async getExpiringInvitations(hoursBeforeExpiry: number = 24): Promise<ExamInvitation[]> {
    const now = new Date();
    const expiryThreshold = new Date(now.getTime() + hoursBeforeExpiry * 60 * 60 * 1000);

    return this.invitationModel
      .find({
        status: { $in: [InvitationStatus.PENDING, InvitationStatus.ACCESSED] },
        expiresAt: { $gte: now, $lte: expiryThreshold },
      })
      .populate('examId')
      .exec();
  }
}
