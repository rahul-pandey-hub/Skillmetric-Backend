import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExamSession, SessionStatus } from '../schemas/exam-session.schema';
import { Violation, ViolationType, ViolationSeverity } from '../schemas/violation.schema';
import { Exam } from '../../exams/schemas/exam.schema';
import { GradingService } from '../../results/services/grading.service';

@Injectable()
@WebSocketGateway({
  namespace: 'proctoring',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ProctoringGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ProctoringGateway.name);

  constructor(
    @InjectModel(ExamSession.name) private sessionModel: Model<ExamSession>,
    @InjectModel(Violation.name) private violationModel: Model<Violation>,
    @InjectModel(Exam.name) private examModel: Model<Exam>,
    private gradingService: GradingService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    const sessionId = client.handshake.query.sessionId as string;

    if (sessionId) {
      client.join(`session-${sessionId}`);
      this.logger.log(`Client ${client.id} joined session ${sessionId}`);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('start-exam')
  async handleStartExam(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      examId: string;
      studentId?: string;
      sessionId?: string;
      accessSource?: string;
    },
  ) {
    try {
      const { examId, studentId, sessionId, accessSource } = data;

      let session;

      if (sessionId) {
        // Session already exists (invitation-based or resumed exam)
        session = await this.sessionModel.findById(sessionId);

        if (!session) {
          client.emit('error', { message: 'Session not found' });
          return;
        }

        this.logger.log(`Joining existing session ${sessionId} (${accessSource || 'ENROLLMENT'})`);
      } else {
        // Create new exam session (regular student exam)
        const exam = await this.examModel.findById(examId);
        if (!exam) {
          client.emit('error', { message: 'Exam not found' });
          return;
        }

        const sessionCode = this.generateSessionCode();
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + exam.duration * 60 * 1000);

        session = new this.sessionModel({
          sessionCode,
          examId: examId,
          candidateId: studentId,
          status: SessionStatus.IN_PROGRESS,
          warningCount: 0,
          startTime,
          endTime,
          violations: [],
          answers: [],
        });

        await session.save();
        this.logger.log(`Created new exam session for student ${studentId}`);
      }

      client.join(`session-${session._id}`);

      client.emit('exam-started', {
        sessionId: session._id,
        sessionCode: session.sessionCode,
        message: sessionId ? 'Joined exam session' : 'Exam session started successfully',
      });

    } catch (error) {
      this.logger.error('Error starting exam:', error);
      client.emit('error', { message: 'Failed to start exam' });
    }
  }

  @SubscribeMessage('violation')
  async handleViolation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      sessionId: string;
      type: ViolationType;
      details: any;
    },
  ) {
    try {
      const { sessionId, type, details } = data;

      // SERVER-SIDE VALIDATION - CRITICAL FEATURE
      // Fetch session from database
      const session = await this.sessionModel.findById(sessionId);

      if (!session) {
        client.emit('error', { message: 'Session not found' });
        return;
      }

      const exam = await this.examModel.findById(session.examId);
      if (!exam) {
        client.emit('error', { message: 'Exam not found' });
        return;
      }

      // Check if session is already submitted/completed
      if (session.status === SessionStatus.COMPLETED || session.status === SessionStatus.AUTO_SUBMITTED) {
        this.logger.warn(`Ignoring violation for already submitted session ${sessionId}`);
        return;
      }

      // Check if proctoring is enabled
      if (!exam.proctoringSettings?.enabled) {
        return;
      }

      // Create violation record
      const violationData: any = {
        session: sessionId,
        exam: session.examId,
        type: type,
        severity: this.determineSeverity(type),
        detectedAt: new Date(),
        details: {
          description: this.getViolationDescription(type),
          evidence: details,
        },
        review: {
          status: 'PENDING',
        },
        warningIssued: true,
      };

      // Set candidate OR invitation based on access source
      if (session.accessSource === 'INVITATION' && session.invitationId) {
        violationData.invitation = session.invitationId;
      } else if (session.candidateId) {
        violationData.candidate = session.candidateId;
      }

      const violation = new this.violationModel(violationData);
      await violation.save();

      // SERVER-SIDE INCREMENT - CANNOT BE MANIPULATED BY CLIENT
      session.warningCount += 1;
      session.violations.push({
        type,
        details,
        timestamp: new Date(),
      });

      await session.save();

      // Check against violation limit
      const violationLimit = exam.proctoringSettings.violationWarningLimit || 3;
      const shouldAutoSubmit = session.warningCount >= violationLimit;

      // Send warning to client
      client.emit('warning', {
        warningCount: session.warningCount,
        maxWarnings: violationLimit,
        violationType: type,
        message: `Warning ${session.warningCount} of ${violationLimit}: ${this.getViolationDescription(type)}`,
      });

      // Broadcast to monitoring admins
      this.server.to(`exam-${exam._id}`).emit('student-violation', {
        sessionId: session._id,
        candidateId: session.candidateId,
        violationType: type,
        warningCount: session.warningCount,
        maxWarnings: violationLimit,
      });

      // AUTO-SUBMIT if limit reached
      if (shouldAutoSubmit && exam.proctoringSettings.autoSubmitOnViolation) {
        violation.autoSubmitTriggered = true;
        await violation.save();

        session.status = SessionStatus.AUTO_SUBMITTED;
        session.autoSubmitReason = `Violation limit exceeded (${session.warningCount}/${violationLimit})`;
        session.submittedAt = new Date();
        await session.save();

        // Force submit on client
        const forceSubmitData = {
          reason: session.autoSubmitReason,
          warningCount: session.warningCount,
          message: 'Exam auto-submitted due to violation limit exceeded',
        };

        client.emit('force-submit', forceSubmitData);
        this.logger.warn(
          `🚨 FORCE-SUBMIT event emitted to client for session ${sessionId}`,
        );
        this.logger.warn(
          `Auto-submitted exam for student ${session.candidateId} due to violations`,
        );

        // Notify admins
        this.server.to(`exam-${exam._id}`).emit('student-auto-submitted', {
          sessionId: session._id,
          candidateId: session.candidateId,
          reason: session.autoSubmitReason,
          finalWarningCount: session.warningCount,
        });
      }

      this.logger.log(
        `Violation ${type} recorded for session ${sessionId}. Warning count: ${session.warningCount}/${violationLimit}`,
      );
    } catch (error) {
      this.logger.error('Error handling violation:', error);
      client.emit('error', { message: 'Failed to record violation' });
    }
  }

  @SubscribeMessage('webcam-stream')
  async handleWebcamStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; frame: any },
  ) {
    const { sessionId } = data;

    // Update session webcam status
    await this.sessionModel.findByIdAndUpdate(sessionId, {
      'proctoring.webcamEnabled': true,
    });

    // Forward to monitoring admins
    this.server.to(`monitoring-${sessionId}`).emit('webcam-frame', data);
  }

  @SubscribeMessage('monitor-session')
  async handleMonitorSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const { sessionId } = data;
    client.join(`monitoring-${sessionId}`);
    this.logger.log(`Admin monitoring session ${sessionId}`);
  }

  @SubscribeMessage('submit-exam')
  async handleSubmitExam(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; answers: any[] },
  ) {
    try {
      const { sessionId, answers } = data;

      const session = await this.sessionModel.findById(sessionId);
      if (!session) {
        client.emit('error', { message: 'Session not found' });
        return;
      }

      session.status = SessionStatus.COMPLETED;
      session.submittedAt = new Date();
      await session.save();

      client.emit('exam-submitted', {
        message: 'Exam submitted successfully',
        sessionId: session._id,
      });

      this.logger.log(`Exam submitted for session ${sessionId}`);

      // NOTE: Result creation is handled by the HTTP submit endpoint
      // to avoid race conditions and duplicate results
    } catch (error) {
      this.logger.error('Error submitting exam:', error);
      client.emit('error', { message: 'Failed to submit exam' });
    }
  }

  private generateSessionCode(): string {
    return `SES-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  private determineSeverity(type: ViolationType): ViolationSeverity {
    const severityMap = {
      [ViolationType.TAB_SWITCH]: ViolationSeverity.MEDIUM,
      [ViolationType.COPY_PASTE]: ViolationSeverity.HIGH,
      [ViolationType.RIGHT_CLICK]: ViolationSeverity.LOW,
      [ViolationType.DEV_TOOLS]: ViolationSeverity.CRITICAL,
      [ViolationType.FULLSCREEN_EXIT]: ViolationSeverity.MEDIUM,
      [ViolationType.NO_FACE]: ViolationSeverity.HIGH,
      [ViolationType.MULTIPLE_FACES]: ViolationSeverity.CRITICAL,
      [ViolationType.CAMERA_DISABLED]: ViolationSeverity.HIGH,
      [ViolationType.SUSPICIOUS_BEHAVIOR]: ViolationSeverity.HIGH,
    };

    return severityMap[type] || ViolationSeverity.MEDIUM;
  }

  private getViolationDescription(type: ViolationType): string {
    const descriptions = {
      [ViolationType.TAB_SWITCH]: 'Tab switching detected',
      [ViolationType.COPY_PASTE]: 'Copy/paste operation detected',
      [ViolationType.RIGHT_CLICK]: 'Right-click detected',
      [ViolationType.DEV_TOOLS]: 'Developer tools opened',
      [ViolationType.FULLSCREEN_EXIT]: 'Exited fullscreen mode',
      [ViolationType.NO_FACE]: 'No face detected in webcam',
      [ViolationType.MULTIPLE_FACES]: 'Multiple faces detected',
      [ViolationType.CAMERA_DISABLED]: 'Camera was disabled',
      [ViolationType.SUSPICIOUS_BEHAVIOR]: 'Suspicious behavior detected',
    };

    return descriptions[type] || 'Unknown violation';
  }
}
