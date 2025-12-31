import { Controller, Get, Post, Body, Param, UseGuards, Request, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Exam, ExamStatus } from '../schemas/exam.schema';
import { Question } from '../../questions/schemas/question.schema';
import { ExamSession, SessionStatus } from '../../proctoring/schemas/exam-session.schema';
import { Result, ResultStatus } from '../../results/schemas/result.schema';
import { User } from '../../users/schemas/user.schema';

interface ShuffledQuestion {
  _id: string;
  questionText: string;
  type: string;
  difficulty: string;
  marks: number;
  options?: any[];
}

@ApiTags('student-exams')
@Controller('student/exams')
export class StudentExamsController {
  constructor(
    @InjectModel(Exam.name) private examModel: Model<Exam>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
    @InjectModel(ExamSession.name) private examSessionModel: Model<ExamSession>,
    @InjectModel(Result.name) private resultModel: Model<Result>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  @Get('debug/enrollment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Debug - Check student enrollment' })
  async debugEnrollment(@Request() req) {
    const studentId = req.user.id;

    // Get all exams
    const allExams = await this.examModel.find().exec();

    // Find exams where student is enrolled
    const enrolledExams = allExams.filter(exam =>
      exam.enrolledStudents.some(id => id.toString() === studentId)
    );

    return {
      studentId,
      totalExams: allExams.length,
      enrolledInCount: enrolledExams.length,
      enrolledExams: enrolledExams.map(e => ({
        id: e._id,
        title: e.title,
        code: e.code,
        enrolledStudents: e.enrolledStudents.map(id => id.toString()),
      })),
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all exams available to student' })
  @ApiResponse({ status: 200, description: 'Student exams retrieved successfully' })
  async getStudentExams(@Request() req) {
    const studentId = req.user.id;

    // Find all exams where student is enrolled
    // Convert studentId to ObjectId and use $in operator
    const exams = await this.examModel
      .find({
        enrolledStudents: { $in: [new Types.ObjectId(studentId)] },
      })
      .select('title code description duration status schedule proctoringSettings grading settings enrolledStudents')
      .sort({ 'schedule.startDate': -1 })
      .exec();

    // For each exam, check if student has already taken it
    const examsWithStatus = await Promise.all(
      exams.map(async (exam) => {
        const session = await this.examSessionModel
          .findOne({
            examId: exam._id,
            studentId: new Types.ObjectId(studentId),
          })
          .sort({ createdAt: -1 })
          .exec();

        const now = new Date();
        const startDate = new Date(exam.schedule.startDate);
        const endDate = new Date(exam.schedule.endDate);

        let examStatus = 'upcoming';
        if (now >= startDate && now <= endDate) {
          examStatus = 'active';
        } else if (now > endDate) {
          examStatus = 'expired';
        }

        return {
          ...exam.toObject(),
          attemptStatus: session?.status || 'not_started',
          attempts: session ? 1 : 0,
          canAttempt: !session && examStatus === 'active',
          examStatus,
        };
      })
    );

    return {
      data: examsWithStatus,
      total: examsWithStatus.length,
    };
  }

  @Get(':examId/access')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get exam access details and check if student can start' })
  @ApiParam({ name: 'examId', description: 'Exam ID' })
  @ApiResponse({ status: 200, description: 'Exam access details retrieved' })
  @ApiResponse({ status: 403, description: 'Student not enrolled or exam not accessible' })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  async getExamAccess(@Param('examId') examId: string, @Request() req) {
    const studentId = req.user.id;

    // Find exam
    const exam = await this.examModel
      .findById(examId)
      .exec();

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // Check if student is enrolled
    const isEnrolled = exam.enrolledStudents.some(
      (id) => id.toString() === studentId
    );

    if (!isEnrolled) {
      throw new BadRequestException('You are not enrolled in this exam');
    }

    // Check exam schedule
    const now = new Date();
    const startDate = new Date(exam.schedule.startDate);
    const endDate = new Date(exam.schedule.endDate);

    if (now < startDate) {
      return {
        canStart: false,
        reason: 'Exam has not started yet',
        startDate: exam.schedule.startDate,
        exam: exam.toObject(),
      };
    }

    // Check if exam has ended
    if (now > endDate) {
      // If late submission is not allowed, block access
      if (!exam.schedule.lateSubmissionAllowed) {
        return {
          canStart: false,
          reason: 'Exam has ended',
          endDate: exam.schedule.endDate,
          exam: exam.toObject(),
        };
      }

      // If late submission is allowed, check the deadline
      if (exam.schedule.lateSubmissionDeadline) {
        const lateDeadline = new Date(exam.schedule.lateSubmissionDeadline);
        if (now > lateDeadline) {
          return {
            canStart: false,
            reason: 'Late submission period has ended',
            endDate: exam.schedule.endDate,
            lateDeadline: exam.schedule.lateSubmissionDeadline,
            exam: exam.toObject(),
          };
        }
      }
    }

    // Check previous attempts
    const previousSession = await this.examSessionModel
      .findOne({
        examId: exam._id,
        studentId: new Types.ObjectId(studentId),
      })
      .exec();

    if (previousSession) {
      const attemptsUsed = 1; // Currently supporting single attempt
      if (attemptsUsed >= exam.settings.attemptsAllowed) {
        return {
          canStart: false,
          reason: 'Maximum attempts reached',
          attemptsUsed,
          maxAttempts: exam.settings.attemptsAllowed,
          exam: exam.toObject(),
        };
      }
    }

    return {
      canStart: true,
      exam: {
        _id: exam._id,
        title: exam.title,
        code: exam.code,
        description: exam.description,
        duration: exam.duration,
        status: exam.status,
        schedule: exam.schedule,
        proctoringSettings: exam.proctoringSettings,
        grading: exam.grading,
        settings: exam.settings,
        questions: exam.questions,
      },
      instructions: {
        duration: exam.duration,
        totalQuestions: exam.questions?.length || 0,
        proctoringEnabled: exam.proctoringSettings?.enabled || false,
        requirements: this.getExamRequirements(exam),
      },
    };
  }

  @Post(':examId/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start exam and get shuffled questions' })
  @ApiParam({ name: 'examId', description: 'Exam ID' })
  @ApiResponse({ status: 200, description: 'Exam started successfully' })
  @ApiResponse({ status: 403, description: 'Cannot start exam' })
  async startExam(@Param('examId') examId: string, @Request() req) {
    const studentId = req.user.id;

    // Verify access first
    const accessCheck = await this.getExamAccess(examId, req);
    if (!accessCheck.canStart) {
      throw new BadRequestException(accessCheck.reason);
    }

    const exam = accessCheck.exam;

    // Check if exam has questions
    if (!exam.questions || exam.questions.length === 0) {
      throw new BadRequestException('This exam has no questions assigned. Please contact your administrator.');
    }

    // Filter valid ObjectIds and log invalid ones
    const validQuestionIds = exam.questions.filter((id: any) => {
      try {
        if (typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)) {
          return true;
        }
        if (id && id._id && typeof id._id === 'object') {
          return true;
        }
        return false;
      } catch (err) {
        return false;
      }
    });

    if (validQuestionIds.length === 0) {
      throw new BadRequestException('This exam has invalid question references. Please contact your administrator to add valid questions.');
    }

    // Load questions with full details
    const questions = await this.questionModel
      .find({
        _id: { $in: validQuestionIds },
      })
      .exec();

    if (questions.length === 0) {
      throw new BadRequestException('No questions found for this exam. Please contact your administrator.');
    }

    // Shuffle questions if required
    let processedQuestions = questions.map((q) => q.toObject());

    if (exam.settings.shuffleQuestions) {
      processedQuestions = this.shuffleArray(processedQuestions);
    }

    // Shuffle options if required and remove correct answers
    const shuffledQuestions = processedQuestions.map((question: any) => {
      let options = question.options || [];

      if (exam.settings.shuffleOptions && options.length > 0) {
        options = this.shuffleArray([...options]);
      }

      // Remove correctAnswer from response for security
      const { correctAnswer, ...questionWithoutAnswer } = question;

      return {
        ...questionWithoutAnswer,
        options,
      };
    });

    processedQuestions = shuffledQuestions;

    // Create exam session
    const session = new this.examSessionModel({
      examId: exam._id,
      studentId: new Types.ObjectId(studentId),
      status: SessionStatus.IN_PROGRESS,
      startTime: new Date(),
      endTime: new Date(Date.now() + exam.duration * 60 * 1000),
      answers: [],
      violations: [],
      warningCount: 0,
      questionOrder: processedQuestions.map((q) => q._id),
    });

    await session.save();

    return {
      sessionId: session._id,
      exam: {
        _id: exam._id,
        title: exam.title,
        duration: exam.duration,
        totalMarks: exam.grading.totalMarks,
      },
      questions: processedQuestions,
      startTime: session.startTime,
      endTime: session.endTime,
      proctoringSettings: exam.proctoringSettings,
    };
  }

  @Post(':examId/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit exam answers' })
  @ApiParam({ name: 'examId', description: 'Exam ID' })
  @ApiResponse({ status: 200, description: 'Exam submitted successfully' })
  async submitExam(
    @Param('examId') examId: string,
    @Body() submitData: { sessionId: string; answers: any[] },
    @Request() req,
  ) {
    const { sessionId, answers } = submitData;

    // Find session
    const session = await this.examSessionModel.findById(sessionId).exec();
    if (!session) {
      throw new NotFoundException('Exam session not found');
    }

    // Verify ownership - check both enrollment and invitation-based access
    const studentId = req.user?.id;
    const invitationId = req.user?.invitationId;

    let isValidSession = false;

    // Check if it's an enrollment-based session
    if (session.studentId && studentId && session.studentId.toString() === studentId) {
      isValidSession = true;
    }

    // Check if it's an invitation-based session
    if (session.invitationId && invitationId && session.invitationId.toString() === invitationId) {
      isValidSession = true;
    }

    if (!isValidSession) {
      throw new BadRequestException('Invalid session');
    }

    // Update session
    session.answers = answers;
    session.status = SessionStatus.COMPLETED;
    session.submittedAt = new Date();
    await session.save();

    // Calculate score
    const exam = await this.examModel.findById(examId).exec();
    const questions = await this.questionModel
      .find({
        _id: { $in: exam.questions },
      })
      .exec();

    let totalScore = 0;
    const gradedAnswers = answers.map((answer) => {
      const question = questions.find((q) => q._id.toString() === answer.questionId);
      if (!question) return { ...answer, isCorrect: false, marks: 0 };

      let isCorrect = false;
      let marks = 0;

      if (question.type === 'TRUE_FALSE') {
        isCorrect = answer.selectedOption === question.correctAnswer;
        marks = isCorrect ? question.marks : (exam.grading.negativeMarking ? -(exam.grading.negativeMarkValue || 0) : 0);
      } else if (question.type === 'MULTIPLE_CHOICE' || question.type === 'MULTIPLE_RESPONSE') {
        // Handle both single and multiple correct answers
        const correctAnswers = Array.isArray(question.correctAnswer)
          ? question.correctAnswer
          : [question.correctAnswer];
        const selectedAnswers = answer.selectedOptions || [];

        isCorrect =
          correctAnswers.length === selectedAnswers.length &&
          correctAnswers.every((ans) => selectedAnswers.includes(ans));
        marks = isCorrect ? question.marks : (exam.grading.negativeMarking ? -(exam.grading.negativeMarkValue || 0) : 0);
      } else if (question.type === 'SHORT_ANSWER' || question.type === 'FILL_BLANK') {
        // For text-based answers, compare trimmed lowercase strings
        const correctAnswer = (question.correctAnswer || '').toString().trim().toLowerCase();
        const studentAnswer = (answer.answer || '').toString().trim().toLowerCase();
        isCorrect = correctAnswer === studentAnswer;
        marks = isCorrect ? question.marks : 0;
      } else if (question.type === 'ESSAY' || question.type === 'SUBJECTIVE' || question.type === 'CODING') {
        // These require manual grading
        marks = 0;
        isCorrect = false;
      }

      totalScore += marks;

      return {
        questionId: answer.questionId,
        isCorrect,
        marks,
        selectedAnswer: answer.selectedOption || answer.selectedOptions || answer.answer,
      };
    });

    // Update session with score
    session.score = totalScore;
    await session.save();

    // Handle invitation-based access
    if (session.accessSource === 'INVITATION' && session.invitationId) {
      // Update invitation status to COMPLETED
      const InvitationModel = this.examSessionModel.db.model('ExamInvitation');
      const invitation = await InvitationModel.findById(session.invitationId);

      if (invitation) {
        const autoExpire = exam.invitationSettings?.autoExpireOnSubmit || false;
        invitation.status = autoExpire ? 'EXPIRED' : 'COMPLETED';
        invitation.examCompletedAt = new Date();
        await invitation.save();
      }

      // Determine result visibility for recruitment exams
      const showScore = exam.recruitmentResultSettings?.showScoreToCandidate !== false;
      const showRank = exam.recruitmentResultSettings?.showRankToCandidate !== false;
      const showOnlyConfirmation = exam.recruitmentResultSettings?.showOnlyConfirmation || false;

      if (showOnlyConfirmation) {
        return {
          submitted: true,
          sessionId: session._id,
          message: exam.recruitmentResultSettings?.candidateResultMessage ||
            'Thank you for completing the assessment. Your submission has been recorded.',
        };
      }

      return {
        submitted: true,
        sessionId: session._id,
        score: showScore ? totalScore : undefined,
        totalMarks: showScore ? exam.grading.totalMarks : undefined,
        passingMarks: showScore ? exam.grading.passingMarks : undefined,
        passed: showScore ? totalScore >= exam.grading.passingMarks : undefined,
        message: exam.recruitmentResultSettings?.candidateResultMessage,
      };
    }

    // Regular enrollment-based response
    return {
      submitted: true,
      sessionId: session._id,
      score: totalScore,
      totalMarks: exam.grading.totalMarks,
      passingMarks: exam.grading.passingMarks,
      passed: totalScore >= exam.grading.passingMarks,
      showResults: exam.settings.showResultsImmediately,
      gradedAnswers: exam.settings.showResultsImmediately ? gradedAnswers : undefined,
    };
  }

  @Post(':sessionId/save-answer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save answer for a question' })
  @ApiResponse({ status: 200, description: 'Answer saved successfully' })
  async saveAnswer(
    @Param('sessionId') sessionId: string,
    @Body() answerData: { questionId: string; answer: any },
    @Request() req,
  ) {
    const studentId = req.user.id;
    const { questionId, answer } = answerData;

    const session = await this.examSessionModel.findById(sessionId).exec();
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Only validate studentId for enrollment-based exams (not invitation-based)
    if (session.studentId && session.studentId.toString() !== studentId) {
      throw new BadRequestException('Invalid session');
    }

    // Update or add answer
    const existingAnswerIndex = session.answers.findIndex(
      (a: any) => a.questionId === questionId
    );

    if (existingAnswerIndex >= 0) {
      session.answers[existingAnswerIndex] = {
        questionId,
        ...answer,
        savedAt: new Date(),
      };
    } else {
      session.answers.push({
        questionId,
        ...answer,
        savedAt: new Date(),
      });
    }

    await session.save();

    return {
      success: true,
      message: 'Answer saved successfully',
    };
  }

  @Get('results')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all exam results for the student' })
  @ApiResponse({ status: 200, description: 'Results retrieved successfully' })
  async getAllResults(@Request() req) {
    const studentId = req.user.id;

    const results = await this.resultModel
      .find({ student: new Types.ObjectId(studentId) })
      .populate('exam', 'title code description grading.totalMarks grading.passingMarks schedule')
      .sort({ createdAt: -1 })
      .exec();

    // Transform results to include exam details
    // Filter out results where exam has been deleted (null)
    const transformedResults = results
      .filter(result => result.exam != null)
      .map(result => ({
        _id: result._id,
        exam: {
          _id: (result.exam as any)._id,
          title: (result.exam as any).title,
          code: (result.exam as any).code,
          description: (result.exam as any).description,
          totalMarks: (result.exam as any).grading?.totalMarks,
          passingMarks: (result.exam as any).grading?.passingMarks,
          schedule: (result.exam as any).schedule,
        },
        status: result.status,
        score: result.score,
        analysis: result.analysis,
        rank: result.rank,
        percentile: result.percentile,
        proctoringReport: result.proctoringReport,
        submittedAt: result.submittedAt,
        publishedAt: result.publishedAt,
        createdAt: (result as any).createdAt,
      }));

    return {
      data: transformedResults,
      total: transformedResults.length,
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get student profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Request() req) {
    const studentId = req.user.id;

    const user = await this.userModel
      .findById(studentId)
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileDetails: user.profile,
      skillProfile: user.skillProfile,
      certifications: user.certifications,
      preferences: user.preferences,
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt,
    };
  }

  @Get(':examId/result')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detailed result for a specific exam' })
  @ApiParam({ name: 'examId', description: 'Exam ID' })
  @ApiResponse({ status: 200, description: 'Result retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Result not found' })
  async getExamResult(@Param('examId') examId: string, @Request() req) {
    const studentId = req.user.id;

    const result = await this.resultModel
      .findOne({
        exam: new Types.ObjectId(examId),
        student: new Types.ObjectId(studentId)
      })
      .populate('exam', 'title code description duration grading settings schedule')
      .exec();

    if (!result) {
      throw new NotFoundException('Result not found for this exam');
    }

    // Get the exam session for additional details
    const session = await this.examSessionModel
      .findOne({
        examId: new Types.ObjectId(examId),
        studentId: new Types.ObjectId(studentId)
      })
      .sort({ createdAt: -1 })
      .exec();

    // Get all results for this exam to calculate ranking
    const allResults = await this.resultModel
      .find({
        exam: new Types.ObjectId(examId),
        status: { $in: [ResultStatus.GRADED, ResultStatus.PUBLISHED] }
      })
      .sort({ 'score.obtained': -1 })
      .exec();

    const totalStudents = allResults.length;
    const studentRank = allResults.findIndex(r => r.student.toString() === studentId) + 1;
    const percentile = totalStudents > 1 ? ((totalStudents - studentRank + 1) / totalStudents) * 100 : 100;

    // Check if student is in top percentage for shortlisting
    const topPercentage = 15; // Top 15%
    const isShortlisted = (percentile >= (100 - topPercentage));

    return {
      _id: result._id,
      exam: {
        _id: (result.exam as any)._id,
        title: (result.exam as any).title,
        code: (result.exam as any).code,
        description: (result.exam as any).description,
        duration: (result.exam as any).duration,
        totalMarks: (result.exam as any).grading?.totalMarks,
        passingMarks: (result.exam as any).grading?.passingMarks,
        settings: (result.exam as any).settings,
        schedule: (result.exam as any).schedule,
      },
      status: result.status,
      score: result.score,
      analysis: result.analysis,
      questionResults: result.questionResults,
      proctoringReport: result.proctoringReport,
      ranking: {
        rank: studentRank,
        outOf: totalStudents,
        percentile: Math.round(percentile * 100) / 100,
        isShortlisted,
      },
      session: session ? {
        startTime: session.startTime,
        endTime: session.endTime,
        submittedAt: session.submittedAt,
        warningCount: session.warningCount,
        violationsCount: session.violations?.length || 0,
      } : null,
      submittedAt: result.submittedAt,
      publishedAt: result.publishedAt,
      evaluatedAt: result.evaluatedAt,
      createdAt: (result as any).createdAt,
    };
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private getExamRequirements(exam: any): string[] {
    const requirements: string[] = [];

    if (exam.proctoringSettings.enabled) {
      requirements.push('Proctoring is enabled for this exam');

      if (exam.proctoringSettings.webcamRequired) {
        requirements.push('Webcam access is required');
      }

      if (exam.proctoringSettings.fullscreenRequired) {
        requirements.push('You must stay in fullscreen mode');
      }

      if (exam.proctoringSettings.tabSwitchDetection) {
        requirements.push('Tab switching will be detected');
      }

      if (exam.proctoringSettings.rightClickDisabled) {
        requirements.push('Right-click is disabled');
      }

      if (exam.proctoringSettings.copyPasteDetection) {
        requirements.push('Copy/paste operations are not allowed');
      }

      requirements.push(`You have ${exam.proctoringSettings.violationWarningLimit} warnings before auto-submission`);
    }

    requirements.push(`Duration: ${exam.duration} minutes`);
    requirements.push(`Total Marks: ${exam.grading.totalMarks}`);
    requirements.push(`Passing Marks: ${exam.grading.passingMarks}`);

    if (exam.grading.negativeMarking) {
      requirements.push(`Negative marking: -${exam.grading.negativeMarkValue} for wrong answers`);
    }

    return requirements;
  }
}
