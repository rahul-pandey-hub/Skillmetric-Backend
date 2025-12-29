import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ExamInvitation, InvitationStatus } from '../../exams/schemas/exam-invitation.schema';
import { ExamSession, SessionStatus } from '../../proctoring/schemas/exam-session.schema';

export interface InvitationJWTPayload {
  type: 'INVITATION';
  invitationId: string;
  examId: string;
  candidateEmail: string;
  candidateName: string;
  expiresAt: number; // Unix timestamp (exam end time + buffer)
}

export interface GuestUser {
  type: 'guest';
  invitationId: string;
  examId: string;
  email: string;
  name: string;
}

@Injectable()
export class InvitationJwtStrategy extends PassportStrategy(
  Strategy,
  'invitation-jwt'
) {
  private readonly logger = new Logger(InvitationJwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(ExamInvitation.name)
    private readonly invitationModel: Model<ExamInvitation>,
    @InjectModel(ExamSession.name)
    private readonly sessionModel: Model<ExamSession>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // JWT expiry is checked automatically
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
    });
  }

  async validate(payload: InvitationJWTPayload): Promise<GuestUser> {
    // Verify payload type
    if (payload.type !== 'INVITATION') {
      throw new UnauthorizedException('Invalid token type');
    }

    // STRICT SESSION TIMEOUT: Verify token hasn't expired based on expiresAt
    const now = Date.now();
    if (payload.expiresAt && now > payload.expiresAt) {
      this.logger.warn(
        `Token expired for invitation ${payload.invitationId}. ` +
        `Expired at: ${new Date(payload.expiresAt).toISOString()}, Now: ${new Date(now).toISOString()}`
      );
      throw new UnauthorizedException('Session has expired. Please contact support if you need more time.');
    }

    // Verify invitation still valid
    const invitation = await this.invitationModel.findById(payload.invitationId);

    if (!invitation) {
      throw new UnauthorizedException('Invitation not found');
    }

    // Check invitation status
    if (invitation.status === InvitationStatus.EXPIRED) {
      throw new UnauthorizedException('Invitation has expired');
    }

    if (invitation.status === InvitationStatus.REVOKED) {
      throw new UnauthorizedException('Invitation has been revoked');
    }

    // Check if exam has already been completed (prevent resubmission)
    if (invitation.status === InvitationStatus.COMPLETED) {
      this.logger.warn(
        `Attempt to use token for completed invitation ${payload.invitationId}`
      );
      throw new UnauthorizedException('Exam has already been submitted. Token is no longer valid.');
    }

    // Invitation must be in STARTED status to use this JWT
    if (invitation.status !== InvitationStatus.STARTED) {
      throw new UnauthorizedException('Invalid invitation status for exam access');
    }

    // Verify the session hasn't been completed or timed out
    if (invitation.sessionId) {
      const session = await this.sessionModel.findById(invitation.sessionId);

      if (session) {
        // Check if session has ended
        if (session.status === SessionStatus.COMPLETED) {
          throw new UnauthorizedException('Exam session has been completed');
        }

        if (session.status === SessionStatus.TIMED_OUT) {
          throw new UnauthorizedException('Exam session has timed out');
        }

        // STRICT TIMEOUT: Verify session hasn't exceeded time limit
        if (session.endTime && now > session.endTime.getTime()) {
          this.logger.warn(
            `Session timeout for invitation ${payload.invitationId}. ` +
            `Session ended at: ${session.endTime.toISOString()}`
          );

          // Update session status to timed out
          session.status = SessionStatus.TIMED_OUT;
          await session.save();

          throw new UnauthorizedException('Exam time limit exceeded. Your session has been terminated.');
        }
      }
    }

    // Verify exam ID matches
    if (invitation.examId.toString() !== payload.examId) {
      throw new UnauthorizedException('Exam ID mismatch');
    }

    // Verify email matches
    if (invitation.candidateEmail.toLowerCase() !== payload.candidateEmail.toLowerCase()) {
      throw new UnauthorizedException('Candidate email mismatch');
    }

    // Return guest user object
    return {
      type: 'guest',
      invitationId: payload.invitationId,
      examId: payload.examId,
      email: payload.candidateEmail,
      name: payload.candidateName,
    };
  }
}
