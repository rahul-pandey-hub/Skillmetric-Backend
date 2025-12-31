import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Result, ResultStatus } from '../schemas/result.schema';
import { Question } from '../../questions/schemas/question.schema';
import { Exam } from '../../exams/schemas/exam.schema';
import { ExamSession } from '../../proctoring/schemas/exam-session.schema';
import { User } from '../../users/schemas/user.schema';
import { GradingUtil } from '../../../common/utils/grading.util';
import { EmailService } from '../../email/services/email.service';
import { CertificateService } from '../../certificates/services/certificate.service';

@Injectable()
export class GradingService {
  constructor(
    @InjectModel(Result.name) private resultModel: Model<Result>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
    @InjectModel(Exam.name) private examModel: Model<Exam>,
    @InjectModel(ExamSession.name) private sessionModel: Model<ExamSession>,
    @InjectModel(User.name) private userModel: Model<User>,
    private emailService: EmailService,
    private certificateService: CertificateService,
  ) {}

  /**
   * Grade an exam session automatically
   */
  async gradeExamSession(sessionId: string): Promise<Result> {
    // Fetch session with answers
    const session = await this.sessionModel
      .findById(sessionId)
      .populate('examId studentId')
      .exec();

    if (!session) {
      throw new NotFoundException('Exam session not found');
    }

    // Fetch exam details
    const exam = await this.examModel
      .findById(session.examId)
      .populate('questions')
      .exec();

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // Fetch all questions
    const questions = await this.questionModel
      .find({ _id: { $in: exam.questions } })
      .exec();

    // Create a map of answers
    const answersMap = new Map();
    if (session.answers && Array.isArray(session.answers)) {
      session.answers.forEach((ans: any) => {
        // Store the full answer object to preserve all answer types
        answersMap.set(ans.questionId?.toString() || ans.questionId, ans);
      });
    }

    // Grade each question
    const questionResults: any[] = [];
    let totalPossibleMarks = 0;

    for (const question of questions) {
      const answerObj = answersMap.get(question._id.toString());
      totalPossibleMarks += question.marks;

      // Extract the actual answer based on question type
      let studentAnswer;
      if (answerObj) {
        if (question.type === 'MULTIPLE_CHOICE' || question.type === 'MULTIPLE_RESPONSE') {
          studentAnswer = answerObj.selectedOptions;
        } else if (question.type === 'TRUE_FALSE') {
          studentAnswer = answerObj.selectedOption;
        } else {
          studentAnswer = answerObj.answer;
        }
      }

      const gradingResult = GradingUtil.gradeQuestion({
        questionType: question.type,
        correctAnswer: question.correctAnswer,
        studentAnswer: studentAnswer,
        marks: question.marks,
        negativeMarks: question.negativeMarks || 0,
      });

      questionResults.push({
        questionId: question._id,
        answer: studentAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect: gradingResult.isCorrect,
        marksObtained: gradingResult.marksObtained,
        totalMarks: question.marks,
        requiresManualGrading: gradingResult.requiresManualGrading,
        feedback: gradingResult.feedback,
      });
    }

    // Calculate total score
    const scoreCalculation = GradingUtil.calculateTotalScore(
      questionResults.map((qr) => ({
        isCorrect: qr.isCorrect,
        marksObtained: qr.marksObtained,
        requiresManualGrading: qr.requiresManualGrading,
        feedback: qr.feedback,
      })),
    );

    // Generate analysis
    const analysis = GradingUtil.generateAnalysis(
      questionResults.map((qr) => ({
        isCorrect: qr.isCorrect,
        marksObtained: qr.marksObtained,
        requiresManualGrading: qr.requiresManualGrading,
        feedback: qr.feedback,
      })),
      totalPossibleMarks,
    );

    // Calculate time spent
    const timeSpent = session.submittedAt
      ? Math.floor(
          (new Date(session.submittedAt).getTime() -
            new Date(session.startTime).getTime()) /
            1000,
        )
      : 0;

    // Apply late submission penalty if applicable
    let finalScore = scoreCalculation.totalMarks;
    let isLateSubmission = false;
    let lateByMinutes = 0;
    let penaltyApplied = 0;

    if (session.submittedAt && exam.schedule?.endDate) {
      const submittedAt = new Date(session.submittedAt);
      const endDate = new Date(exam.schedule.endDate);

      if (submittedAt > endDate) {
        isLateSubmission = true;
        lateByMinutes = Math.floor(
          (submittedAt.getTime() - endDate.getTime()) / (1000 * 60)
        );

        // Apply penalty if late submission is allowed
        if (exam.schedule.lateSubmissionAllowed && exam.schedule.lateSubmissionPenalty) {
          penaltyApplied = exam.schedule.lateSubmissionPenalty;
          finalScore = Math.max(0, finalScore - penaltyApplied);
        }
      }
    }

    // Calculate final percentage after penalty
    const finalPercentage =
      totalPossibleMarks > 0
        ? (finalScore / totalPossibleMarks) * 100
        : 0;

    // Determine pass/fail based on final score
    const passingMarks = exam.grading?.passingMarks || totalPossibleMarks * 0.4;
    const passed = finalScore >= passingMarks;

    // Fetch violations count
    const violationsCount = session.violations?.length || 0;
    const violationBreakdown = await this.getViolationBreakdown(sessionId);

    // Determine result status
    const status = scoreCalculation.requiresManualGrading
      ? ResultStatus.PENDING
      : ResultStatus.GRADED;

    // Create or update result
    const result = await this.resultModel.findOneAndUpdate(
      { exam: exam._id, student: session.studentId },
      {
        exam: exam._id,
        student: session.studentId,
        session: session._id,
        status,
        score: {
          obtained: Math.max(0, finalScore), // Use final score after penalty
          total: totalPossibleMarks,
          percentage: Math.max(0, finalPercentage), // Use final percentage after penalty
          passed,
        },
        questionResults,
        analysis: {
          timeSpent,
          attempted: analysis.attempted,
          correct: analysis.correct,
          incorrect: analysis.incorrect,
          unanswered: analysis.unanswered,
          accuracy: analysis.accuracy,
        },
        proctoringReport: {
          totalViolations: violationsCount,
          violationBreakdown,
          autoSubmitted: session.autoSubmitReason ? true : false,
          warningsIssued: session.warningCount || 0,
        },
        lateSubmission: isLateSubmission ? {
          isLate: true,
          lateByMinutes,
          penaltyApplied,
          originalScore: scoreCalculation.totalMarks,
        } : undefined,
      },
      { new: true, upsert: true },
    );

    return result;
  }

  /**
   * Manually grade a specific question
   */
  async manuallyGradeQuestion(
    resultId: string,
    questionId: string,
    marksAwarded: number,
    feedback?: string,
  ): Promise<Result> {
    const result = await this.resultModel.findById(resultId);

    if (!result) {
      throw new NotFoundException('Result not found');
    }

    // Find the question result
    const questionResult = result.questionResults.find(
      (qr: any) => qr.questionId.toString() === questionId,
    );

    if (!questionResult) {
      throw new NotFoundException('Question result not found');
    }

    // Update the question result
    questionResult.marksObtained = marksAwarded;
    questionResult.isCorrect = marksAwarded > 0;
    questionResult.requiresManualGrading = false;
    if (feedback) {
      questionResult.feedback = feedback;
    }

    // Recalculate total score
    const totalObtained = result.questionResults.reduce(
      (sum: number, qr: any) => sum + (qr.marksObtained || 0),
      0,
    );

    result.score.obtained = Math.max(0, totalObtained);
    result.score.percentage =
      result.score.total > 0
        ? (result.score.obtained / result.score.total) * 100
        : 0;

    // Check if all questions are graded
    const allGraded = result.questionResults.every(
      (qr: any) => !qr.requiresManualGrading,
    );

    if (allGraded) {
      result.status = ResultStatus.GRADED;
    }

    await result.save();

    return result;
  }

  /**
   * Publish results to students and send notification emails
   */
  async publishResults(examId: string): Promise<{ publishedCount: number; emailsQueued: number }> {
    // Get exam details
    const exam = await this.examModel.findById(examId).exec();
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // Get all GRADED results with student details
    const results = await this.resultModel
      .find({ exam: examId, status: ResultStatus.GRADED })
      .populate('student')
      .exec();

    let publishedCount = 0;
    let emailsQueued = 0;

    for (const result of results) {
      // Update result status
      result.status = ResultStatus.PUBLISHED;
      result.publishedAt = new Date();
      await result.save();
      publishedCount++;

      // Generate certificate for passed students
      let certificateUrl = result.certificate?.certificateUrl;
      if (result.score?.passed && exam.resultsSettings?.generateCertificate) {
        try {
          certificateUrl = await this.certificateService.generateCertificate(
            result._id.toString(),
          );
        } catch (error) {
          // Continue even if certificate generation fails
        }
      }

      // Queue result notification email
      try {
        const student = result.student as any;
        await this.emailService.queueResultNotificationEmail({
          studentId: student._id.toString(),
          studentName: student.name,
          studentEmail: student.email,
          examId: examId,
          examTitle: exam.title,
          score: result.score.obtained,
          totalMarks: result.score.total,
          percentage: result.score.percentage,
          passed: result.score.passed,
          rank: result.rank,
          percentile: result.percentile,
          shortlisted: result.shortlisted,
          certificateUrl: certificateUrl, // Use newly generated certificate URL
          lateSubmission: result.lateSubmission,
        });

        // Track email sent
        if (!result.emailTracking) {
          result.emailTracking = {
            enrollmentSent: false,
            resultSent: true,
            remindersSent: 0,
          };
        } else {
          result.emailTracking.resultSent = true;
        }
        result.emailTracking.resultSentAt = new Date();
        await result.save();

        emailsQueued++;
      } catch (error) {
        // Track email error
        if (!result.emailTracking) {
          result.emailTracking = {
            enrollmentSent: false,
            resultSent: false,
            remindersSent: 0,
          };
        }
        result.emailTracking.resultError = error.message;
        await result.save();

        // Continue with other emails even if one fails
      }
    }

    return { publishedCount, emailsQueued };
  }

  /**
   * Get violation breakdown for a session
   */
  private async getViolationBreakdown(sessionId: string): Promise<any> {
    const session = await this.sessionModel
      .findById(sessionId)
      .populate('violations')
      .exec();

    if (!session || !session.violations) {
      return {};
    }

    const breakdown: any = {};
    (session.violations as any[]).forEach((violation: any) => {
      const type = violation.type || 'UNKNOWN';
      breakdown[type] = (breakdown[type] || 0) + 1;
    });

    return breakdown;
  }

  /**
   * Get results for a specific exam
   */
  async getExamResults(examId: string): Promise<Result[]> {
    return this.resultModel
      .find({ exam: examId })
      .populate('student', 'name email studentId')
      .sort({ 'score.obtained': -1 })
      .exec();
  }

  /**
   * Get result for a specific student
   */
  async getStudentResult(examId: string, studentId: string): Promise<Result> {
    const result = await this.resultModel
      .findOne({ exam: examId, student: studentId })
      .populate('student', 'name email studentId')
      .exec();

    if (!result) {
      throw new NotFoundException('Result not found');
    }

    return result;
  }

  /**
   * Calculate ranks for all students in an exam
   */
  async calculateRanks(examId: string): Promise<void> {
    const results = await this.resultModel
      .find({ exam: examId, status: { $in: [ResultStatus.GRADED, ResultStatus.PUBLISHED] } })
      .sort({ 'score.obtained': -1, 'analysis.timeSpent': 1 }) // Higher score, less time = better rank
      .exec();

    const totalStudents = results.length;

    for (let i = 0; i < results.length; i++) {
      results[i].rank = i + 1;
      results[i].percentile =
        totalStudents > 1
          ? ((totalStudents - i) / totalStudents) * 100
          : 100;
      await results[i].save();
    }
  }
}
