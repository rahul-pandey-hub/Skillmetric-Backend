import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExamSession } from '../schemas/exam-session.schema';
import { Violation } from '../schemas/violation.schema';

@Injectable()
export class ProctoringService {
  constructor(
    @InjectModel(ExamSession.name) private sessionModel: Model<ExamSession>,
    @InjectModel(Violation.name) private violationModel: Model<Violation>,
  ) {}

  async getSessionViolations(sessionId: string) {
    return this.violationModel
      .find({ session: sessionId })
      .sort({ detectedAt: -1 })
      .exec();
  }

  async getExamSessions(examId: string) {
    return this.sessionModel
      .find({ examId: examId })
      .populate('studentId', 'name email studentId')
      .sort({ startTime: -1 })
      .exec();
  }

  async getSessionDetails(sessionId: string) {
    return this.sessionModel
      .findById(sessionId)
      .populate('studentId', 'name email studentId')
      .populate('examId', 'title code')
      .populate('violations')
      .exec();
  }
}
