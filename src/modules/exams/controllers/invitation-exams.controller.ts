import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { InvitationAccessGuard } from '../../../common/guards/invitation-access.guard';
import { InvitationTokenService } from '../services/invitation-token.service';
import { Exam } from '../schemas/exam.schema';
import { Question } from '../../questions/schemas/question.schema';
import { ExamSession, SessionStatus } from '../../proctoring/schemas/exam-session.schema';
import { InvitationJWTPayload } from '../../auth/strategies/invitation-jwt.strategy';

@ApiTags('invitation-exams')
@Controller('exams/invitation')
export class InvitationExamsController {
  constructor(
    private readonly invitationTokenService: InvitationTokenService,
    private readonly jwtService: JwtService,
    @InjectModel(Exam.name) private readonly examModel: Model<Exam>,
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    @InjectModel(ExamSession.name)
    private readonly examSessionModel: Model<ExamSession>,
  ) {}

  /**
   * GET /exams/invitation/:token
   * Public endpoint - no authentication required
   * Validates invitation token and returns exam details if valid
   */
  @Get(':token')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per 60 seconds per IP to prevent token enumeration
  @UseGuards(InvitationAccessGuard)
  @ApiOperation({
    summary: 'Access exam via invitation token',
    description: 'Public endpoint to validate invitation and get exam details',
  })
  @ApiParam({ name: 'token', description: 'Invitation token (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Invitation is valid, exam details returned',
  })
  @ApiResponse({
    status: 400,
    description: 'Invitation expired, revoked, or invalid',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - rate limit exceeded',
  })
  async getExamByInvitation(@Param('token') token: string, @Request() req) {
    // invitation is already validated and attached by InvitationAccessGuard
    const invitation = req.invitation;

    // Populate exam details
    const exam = await this.examModel.findById(invitation.examId).exec();

    if (!exam) {
      throw new BadRequestException('Exam not found');
    }

    // Check if invitation has already been used (completed)
    const now = new Date();
    const startDate = exam.schedule?.startDate ? new Date(exam.schedule.startDate) : null;
    const endDate = exam.schedule?.endDate ? new Date(exam.schedule.endDate) : null;

    // Determine if candidate can start the exam
    let canStart = true;
    let reason = '';

    // Check schedule
    if (startDate && now < startDate) {
      canStart = false;
      reason = `Exam has not started yet. Starts on ${startDate.toLocaleString()}`;
    } else if (endDate && now > endDate && !exam.schedule?.lateSubmissionAllowed) {
      canStart = false;
      reason = 'Exam has ended';
    }

    // Check if exam has questions
    if (!exam.questions || exam.questions.length === 0) {
      canStart = false;
      reason = 'This exam has no questions. Please contact the administrator.';
    }

    return {
      valid: true,
      exam: {
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        duration: exam.duration,
        category: exam.category,
        totalQuestions: exam.questions?.length || 0,
        totalMarks: exam.grading?.totalMarks,
        passingMarks: exam.grading?.passingMarks,
        instructions: this.getExamInstructions(exam),
        proctoringEnabled: exam.proctoringSettings?.enabled || false,
      },
      candidate: {
        name: invitation.candidateName,
        email: invitation.candidateEmail,
      },
      invitation: {
        expiresAt: invitation.expiresAt,
        status: invitation.status,
        accessCount: invitation.accessCount,
      },
      canStart,
      reason: canStart ? undefined : reason,
    };
  }

  /**
   * POST /exams/invitation/:token/start
   * Public endpoint - validates invitation and starts exam
   * Returns temporary JWT for taking the exam
   */
  @Post(':token/start')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 attempts per 60 seconds (allow for retries)
  @UseGuards(InvitationAccessGuard)
  @ApiOperation({
    summary: 'Start exam via invitation',
    description: 'Creates exam session and returns temporary JWT for guest access',
  })
  @ApiParam({ name: 'token', description: 'Invitation token (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Exam started successfully, temporary JWT returned',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot start exam (expired, already started, etc.)',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - rate limit exceeded',
  })
  async startExamByInvitation(@Param('token') token: string, @Request() req) {
    const invitation = req.invitation;

    // Check if invitation already has an active session
    if (invitation.sessionId) {
      // Check if session is still in progress
      const existingSession = await this.examSessionModel.findById(
        invitation.sessionId
      );

      if (
        existingSession &&
        existingSession.status === SessionStatus.IN_PROGRESS
      ) {
        // Allow continuing the exam - load questions for resume
        const exam = await this.examModel.findById(invitation.examId);

        // Load questions based on the original question order from session
        const questions = await this.questionModel
          .find({
            _id: { $in: existingSession.questionOrder },
          })
          .exec();

        // Reorder questions to match session's question order
        const orderedQuestions = existingSession.questionOrder.map((qId) =>
          questions.find((q) => q._id.toString() === qId.toString())
        ).filter(Boolean);

        // Remove correct answers from questions
        const shuffledQuestions = orderedQuestions.map((question: any) => {
          const questionObj = question.toObject();
          const { correctAnswer, ...questionWithoutAnswer } = questionObj;
          return questionWithoutAnswer;
        });

        // Generate temporary JWT
        const temporaryToken = await this.generateTemporaryJWT(
          invitation,
          exam
        );

        return {
          message: 'Resuming exam session',
          temporaryToken,
          sessionId: existingSession._id,
          exam: {
            _id: exam._id,
            title: exam.title,
            duration: exam.duration,
            totalMarks: exam.grading.totalMarks,
          },
          questions: shuffledQuestions,
          startTime: existingSession.startTime,
          endTime: existingSession.endTime,
          proctoringSettings: exam.proctoringSettings,
        };
      }
    }

    // Load exam
    const exam = await this.examModel.findById(invitation.examId).exec();

    if (!exam) {
      throw new BadRequestException('Exam not found');
    }

    // Validate exam can be started
    const now = new Date();
    const startDate = exam.schedule?.startDate
      ? new Date(exam.schedule.startDate)
      : null;
    const endDate = exam.schedule?.endDate ? new Date(exam.schedule.endDate) : null;

    if (startDate && now < startDate) {
      throw new BadRequestException(
        `Exam has not started yet. Starts on ${startDate.toLocaleString()}`
      );
    }

    if (
      endDate &&
      now > endDate &&
      !exam.schedule?.lateSubmissionAllowed
    ) {
      throw new BadRequestException('Exam has ended');
    }

    // Check if exam has questions
    if (!exam.questions || exam.questions.length === 0) {
      throw new BadRequestException(
        'This exam has no questions. Please contact the administrator.'
      );
    }

    // Load questions
    const questions = await this.questionModel
      .find({
        _id: { $in: exam.questions },
      })
      .exec();

    if (questions.length === 0) {
      throw new BadRequestException('No questions found for this exam');
    }

    // Shuffle questions if required
    let processedQuestions = questions.map((q) => q.toObject());

    if (exam.settings?.shuffleQuestions) {
      processedQuestions = this.shuffleArray(processedQuestions);
    }

    // Shuffle options and remove correct answers
    const shuffledQuestions = processedQuestions.map((question: any) => {
      let options = question.options || [];

      if (exam.settings?.shuffleOptions && options.length > 0) {
        options = this.shuffleArray([...options]);
      }

      // Remove correctAnswer from response
      const { correctAnswer, ...questionWithoutAnswer } = question;

      return {
        ...questionWithoutAnswer,
        options,
      };
    });

    // Create exam session
    const session = new this.examSessionModel({
      examId: exam._id,
      studentId: null, // No student ID for invitation-based access
      accessSource: 'INVITATION',
      invitationId: invitation._id,
      guestCandidateInfo: {
        email: invitation.candidateEmail,
        name: invitation.candidateName,
        phone: invitation.candidatePhone,
      },
      status: SessionStatus.IN_PROGRESS,
      startTime: new Date(),
      endTime: new Date(Date.now() + exam.duration * 60 * 1000),
      answers: [],
      violations: [],
      warningCount: 0,
      questionOrder: shuffledQuestions.map((q) => q._id),
    });

    await session.save();

    // Update invitation status and link to session
    await this.invitationTokenService.markAsStarted(
      invitation._id.toString(),
      session._id.toString()
    );

    // Generate temporary JWT for this exam session
    const temporaryToken = await this.generateTemporaryJWT(invitation, exam);

    return {
      message: 'Exam started successfully',
      temporaryToken,
      sessionId: session._id,
      exam: {
        _id: exam._id,
        title: exam.title,
        duration: exam.duration,
        totalMarks: exam.grading.totalMarks,
      },
      questions: shuffledQuestions,
      startTime: session.startTime,
      endTime: session.endTime,
      proctoringSettings: exam.proctoringSettings,
    };
  }

  /**
   * Generate temporary JWT for guest exam access
   * Valid only for the duration of the exam + 15 minute buffer
   */
  private async generateTemporaryJWT(invitation: any, exam: any): Promise<string> {
    // Calculate JWT expiry (exam end time + 15 minute buffer)
    const examDurationMs = exam.duration * 60 * 1000;
    const bufferMs = 15 * 60 * 1000; // 15 minutes
    const expiresAt = Date.now() + examDurationMs + bufferMs;

    const payload: InvitationJWTPayload = {
      type: 'INVITATION',
      invitationId: invitation._id.toString(),
      examId: invitation.examId.toString(),
      candidateEmail: invitation.candidateEmail,
      candidateName: invitation.candidateName,
      expiresAt,
    };

    // Sign JWT with expiry
    return this.jwtService.sign(payload, {
      expiresIn: Math.floor((examDurationMs + bufferMs) / 1000), // in seconds
    });
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private getExamInstructions(exam: any): string[] {
    const instructions: string[] = [];

    instructions.push(`Duration: ${exam.duration} minutes`);
    instructions.push(`Total Questions: ${exam.questions?.length || 0}`);
    instructions.push(`Total Marks: ${exam.grading?.totalMarks}`);
    instructions.push(`Passing Marks: ${exam.grading?.passingMarks}`);

    if (exam.grading?.negativeMarking) {
      instructions.push(
        `Negative marking: -${exam.grading.negativeMarkValue} for wrong answers`
      );
    }

    if (exam.proctoringSettings?.enabled) {
      instructions.push('Proctoring is enabled for this exam');

      if (exam.proctoringSettings.webcamRequired) {
        instructions.push('Webcam access is required');
      }

      if (exam.proctoringSettings.tabSwitchDetection) {
        instructions.push('Tab switching will be detected');
      }

      if (exam.proctoringSettings.copyPasteDetection) {
        instructions.push('Copy/paste operations are not allowed');
      }

      instructions.push(
        `You have ${exam.proctoringSettings.violationWarningLimit} warnings before auto-submission`
      );
    }

    return instructions;
  }
}
