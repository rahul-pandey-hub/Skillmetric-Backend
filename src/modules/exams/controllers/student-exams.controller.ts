import { Controller, Get, Post, Body, Param, UseGuards, Request, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Exam, ExamStatus } from '../schemas/exam.schema';
import { Question } from '../../questions/schemas/question.schema';
import { ExamSession, SessionStatus } from '../../proctoring/schemas/exam-session.schema';

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

    console.log('Getting exams for student:', studentId);
    console.log('Student ID type:', typeof studentId);

    // Find all exams where student is enrolled
    // Convert studentId to ObjectId and use $in operator
    const exams = await this.examModel
      .find({
        enrolledStudents: { $in: [new Types.ObjectId(studentId)] },
      })
      .select('title code description duration status schedule proctoringSettings grading settings enrolledStudents')
      .sort({ 'schedule.startDate': -1 })
      .exec();

    console.log('Found exams:', exams.length);

    if (exams.length === 0) {
      // Try alternate query for debugging
      const allExams = await this.examModel.find().limit(5).exec();
      console.log('Sample exam enrolledStudents:', allExams.map(e => ({
        title: e.title,
        enrolledStudents: e.enrolledStudents,
        types: e.enrolledStudents.map(id => typeof id),
      })));
    }

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

    if (now > endDate && !exam.schedule.lateSubmissionAllowed) {
      return {
        canStart: false,
        reason: 'Exam has ended',
        endDate: exam.schedule.endDate,
        exam: exam.toObject(),
      };
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

    // Load questions with full details
    const questions = await this.questionModel
      .find({
        _id: { $in: exam.questions },
      })
      .exec();

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
    const studentId = req.user.id;

    // Find session
    const session = await this.examSessionModel.findById(sessionId).exec();
    if (!session) {
      throw new NotFoundException('Exam session not found');
    }

    // Verify ownership
    if (session.studentId.toString() !== studentId) {
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
      } else if (question.type === 'MULTIPLE_CHOICE') {
        const correctAnswers = question.correctAnswer as string[];
        const selectedAnswers = answer.selectedOptions || [];
        isCorrect =
          correctAnswers.length === selectedAnswers.length &&
          correctAnswers.every((ans) => selectedAnswers.includes(ans));
        marks = isCorrect ? question.marks : (exam.grading.negativeMarking ? -(exam.grading.negativeMarkValue || 0) : 0);
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

    if (session.studentId.toString() !== studentId) {
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
