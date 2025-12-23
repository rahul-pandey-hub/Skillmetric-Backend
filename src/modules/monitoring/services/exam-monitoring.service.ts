import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Exam } from '../../exams/schemas/exam.schema';
import { ExamSession } from '../../proctoring/schemas/exam-session.schema';
import { Result } from '../../results/schemas/result.schema';

export interface LiveExamStats {
  examId: string;
  examTitle: string;
  status: string;
  schedule: {
    startDate: Date;
    endDate: Date;
    timeRemaining?: number;
  };
  participation: {
    totalEnrolled: number;
    totalStarted: number;
    totalInProgress: number;
    totalSubmitted: number;
    notStarted: number;
  };
  recentActivity: {
    timestamp: Date;
    studentId: string;
    studentName?: string;
    action: 'STARTED' | 'SUBMITTED' | 'VIOLATION';
    details?: string;
  }[];
  violations: {
    totalViolations: number;
    recentViolations: {
      timestamp: Date;
      studentId: string;
      studentName?: string;
      type: string;
      severity: string;
    }[];
  };
  liveStudents: {
    studentId: string;
    studentName?: string;
    studentEmail?: string;
    status: string;
    startedAt: Date;
    timeElapsed: number;
    warningCount: number;
    lastActivity?: Date;
  }[];
}

@Injectable()
export class ExamMonitoringService {
  constructor(
    @InjectModel(Exam.name) private examModel: Model<Exam>,
    @InjectModel(ExamSession.name) private sessionModel: Model<ExamSession>,
    @InjectModel(Result.name) private resultModel: Model<Result>,
  ) {}

  /**
   * Get live statistics for an active exam
   * Returns real-time data about students, violations, and progress
   */
  async getLiveExamStats(examId: string): Promise<LiveExamStats> {
    const exam = await this.examModel.findById(examId).populate('enrolledStudents');
    if (!exam) {
      throw new Error('Exam not found');
    }

    const now = new Date();
    const timeRemaining = exam.schedule?.endDate
      ? Math.max(0, Math.floor((exam.schedule.endDate.getTime() - now.getTime()) / 1000))
      : undefined;

    // Get all sessions for this exam
    const sessions = await this.sessionModel
      .find({ examId: examId })
      .populate('studentId', 'name email')
      .sort({ updatedAt: -1 });

    // Calculate participation
    const totalEnrolled = exam.enrolledStudents.length;
    const totalStarted = sessions.filter((s) => s.status !== 'ACTIVE').length;
    const totalInProgress = sessions.filter((s) => s.status === 'IN_PROGRESS').length;
    const totalSubmitted = sessions.filter((s) => s.status === 'COMPLETED').length;
    const notStarted = totalEnrolled - totalStarted;

    // Get recent activity (last 20 events)
    const recentActivity = this.extractRecentActivity(sessions).slice(0, 20);

    // Get violation summary
    const violations = this.extractViolationSummary(sessions);

    // Get live students (currently taking exam)
    const liveStudents = this.extractLiveStudents(sessions, now);

    return {
      examId,
      examTitle: exam.title,
      status: exam.status,
      schedule: {
        startDate: exam.schedule?.startDate,
        endDate: exam.schedule?.endDate,
        timeRemaining,
      },
      participation: {
        totalEnrolled,
        totalStarted,
        totalInProgress,
        totalSubmitted,
        notStarted,
      },
      recentActivity,
      violations,
      liveStudents,
    };
  }

  /**
   * Get all active exams (currently in progress)
   */
  async getActiveExams() {
    const now = new Date();

    const activeExams = await this.examModel.find({
      status: { $in: ['PUBLISHED', 'ACTIVE'] },
      'schedule.startDate': { $lte: now },
      'schedule.endDate': { $gte: now },
    });

    const examStats = await Promise.all(
      activeExams.map(async (exam) => {
        const sessions = await this.sessionModel.find({ examId: exam._id });
        const inProgress = sessions.filter((s) => s.status === 'IN_PROGRESS').length;

        return {
          examId: exam._id,
          examTitle: exam.title,
          examCode: exam.code,
          startDate: exam.schedule?.startDate,
          endDate: exam.schedule?.endDate,
          totalEnrolled: exam.enrolledStudents.length,
          inProgress,
          timeRemaining: exam.schedule?.endDate
            ? Math.max(0, Math.floor((exam.schedule.endDate.getTime() - now.getTime()) / 1000))
            : 0,
        };
      }),
    );

    return examStats.filter((e) => e.inProgress > 0 || e.timeRemaining > 0);
  }

  /**
   * Get violation alerts for monitoring dashboard
   */
  async getViolationAlerts(examId?: string) {
    const query: any = {
      violations: { $exists: true, $ne: [] },
      status: 'IN_PROGRESS',
    };

    if (examId) {
      query.examId = examId;
    }

    const sessionsWithViolations = await this.sessionModel
      .find(query)
      .populate('studentId', 'name email')
      .populate('examId', 'title code')
      .sort({ updatedAt: -1 })
      .limit(50);

    return sessionsWithViolations.map((session) => {
      const latestViolation = session.violations?.[session.violations.length - 1];

      return {
        sessionId: session._id,
        examId: (session.examId as any)?._id || session.examId,
        examTitle: (session.examId as any)?.title,
        examCode: (session.examId as any)?.code,
        studentId: (session.studentId as any)?._id || session.studentId,
        studentName: (session.studentId as any)?.name,
        studentEmail: (session.studentId as any)?.email,
        totalViolations: session.violations?.length || 0,
        warningCount: session.warningCount || 0,
        latestViolation: latestViolation
          ? {
              type: latestViolation.type,
              timestamp: latestViolation.timestamp,
              severity: latestViolation.severity || 'MEDIUM',
            }
          : null,
        startedAt: session.startTime,
      };
    });
  }

  /**
   * Get system-wide monitoring stats
   */
  async getSystemStats() {
    const now = new Date();

    // Active exams
    const activeExamsCount = await this.examModel.countDocuments({
      status: { $in: ['PUBLISHED', 'ACTIVE'] },
      'schedule.startDate': { $lte: now },
      'schedule.endDate': { $gte: now },
    });

    // Active sessions
    const activeSessions = await this.sessionModel.countDocuments({
      status: 'IN_PROGRESS',
    });

    // Total violations in last hour
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentSessions = await this.sessionModel.find({
      updatedAt: { $gte: oneHourAgo },
      violations: { $exists: true, $ne: [] },
    });

    const recentViolations = recentSessions.reduce(
      (sum, session) =>
        sum +
        (session.violations?.filter((v: any) => new Date(v.timestamp) >= oneHourAgo).length || 0),
      0,
    );

    // Completed exams today
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const completedToday = await this.resultModel.countDocuments({
      submittedAt: { $gte: startOfDay },
      status: { $in: ['GRADED', 'PUBLISHED'] },
    });

    return {
      activeExams: activeExamsCount,
      activeSessions,
      recentViolations,
      completedToday,
      timestamp: now,
    };
  }

  /**
   * Get detailed session info for a specific student
   */
  async getStudentSession(sessionId: string) {
    const session = await this.sessionModel
      .findById(sessionId)
      .populate('studentId', 'name email')
      .populate('examId', 'title code duration');

    if (!session) {
      throw new Error('Session not found');
    }

    const timeElapsed = session.startTime
      ? Math.floor((new Date().getTime() - session.startTime.getTime()) / 1000)
      : 0;

    return {
      sessionId: session._id,
      exam: {
        id: (session.examId as any)?._id || session.examId,
        title: (session.examId as any)?.title,
        code: (session.examId as any)?.code,
        duration: (session.examId as any)?.duration,
      },
      student: {
        id: (session.studentId as any)?._id || session.studentId,
        name: (session.studentId as any)?.name,
        email: (session.studentId as any)?.email,
      },
      status: session.status,
      startedAt: session.startTime,
      timeElapsed,
      warningCount: session.warningCount || 0,
      violations: session.violations || [],
      answers: session.answers || [],
      lastActivity: (session as any).updatedAt,
    };
  }

  // Helper methods

  private extractRecentActivity(sessions: any[]): any[] {
    const activity: any[] = [];

    sessions.forEach((session) => {
      // Started event
      if (session.startTime) {
        activity.push({
          timestamp: session.startTime,
          studentId: session.studentId?._id || session.studentId,
          studentName: session.studentId?.name,
          action: 'STARTED' as const,
          details: `Started exam`,
        });
      }

      // Submitted event
      if (session.status === 'COMPLETED' && session.endTime) {
        activity.push({
          timestamp: session.endTime,
          studentId: session.studentId?._id || session.studentId,
          studentName: session.studentId?.name,
          action: 'SUBMITTED' as const,
          details: `Submitted exam`,
        });
      }

      // Violation events
      if (session.violations && session.violations.length > 0) {
        session.violations.forEach((violation: any) => {
          activity.push({
            timestamp: violation.timestamp,
            studentId: session.studentId?._id || session.studentId,
            studentName: session.studentId?.name,
            action: 'VIOLATION' as const,
            details: `${violation.type} violation detected`,
          });
        });
      }
    });

    // Sort by timestamp descending
    return activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private extractViolationSummary(sessions: any[]) {
    const recentViolations: any[] = [];
    let totalViolations = 0;

    sessions.forEach((session) => {
      if (session.violations && session.violations.length > 0) {
        totalViolations += session.violations.length;

        session.violations.forEach((violation: any) => {
          recentViolations.push({
            timestamp: violation.timestamp,
            studentId: session.studentId?._id || session.studentId,
            studentName: session.studentId?.name,
            type: violation.type,
            severity: violation.severity || 'MEDIUM',
          });
        });
      }
    });

    // Sort by timestamp descending and take last 10
    recentViolations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      totalViolations,
      recentViolations: recentViolations.slice(0, 10),
    };
  }

  private extractLiveStudents(sessions: any[], now: Date): any[] {
    return sessions
      .filter((s) => s.status === 'IN_PROGRESS')
      .map((session) => {
        const timeElapsed = session.startTime
          ? Math.floor((now.getTime() - session.startTime.getTime()) / 1000)
          : 0;

        return {
          studentId: session.studentId?._id || session.studentId,
          studentName: session.studentId?.name,
          studentEmail: session.studentId?.email,
          status: session.status,
          startedAt: session.startTime,
          timeElapsed,
          warningCount: session.warningCount || 0,
          lastActivity: session.updatedAt,
        };
      })
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }
}
