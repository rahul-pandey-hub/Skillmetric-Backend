import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Request, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';
import { CreateExamCommand } from '../commands/impl/create-exam.command';
import { AddQuestionsToExamCommand } from '../commands/impl/add-questions-to-exam.command';
import { RemoveQuestionsFromExamCommand } from '../commands/impl/remove-questions-from-exam.command';
import { EnrollStudentsCommand } from '../commands/impl/enroll-students.command';
import { SendInvitationsCommand } from '../commands/impl/send-invitations.command';
import { CreateExamDto } from '../dto/create-exam.dto';
import { AddQuestionsDto } from '../dto/add-questions.dto';
import { RemoveQuestionsDto } from '../dto/remove-questions.dto';
import { EnrollStudentsDto } from '../dto/enroll-students.dto';
import { SendInvitationsDto } from '../dto/send-invitations.dto';
import { Exam } from '../schemas/exam.schema';
import { Result } from '../../results/schemas/result.schema';
import { ExamSession } from '../../proctoring/schemas/exam-session.schema';
import { Violation } from '../../proctoring/schemas/violation.schema';
import { User } from '../../users/schemas/user.schema';
import { Question } from '../../questions/schemas/question.schema';

@ApiTags('exams')
@Controller('exams')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationGuard)
export class ExamsController {
  constructor(
    private readonly commandBus: CommandBus,
    @InjectModel(Exam.name) private examModel: Model<Exam>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
    @InjectModel(Result.name) private resultModel: Model<Result>,
    @InjectModel(ExamSession.name) private sessionModel: Model<ExamSession>,
    @InjectModel(Violation.name) private violationModel: Model<Violation>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  @Post()
  @Roles(UserRole.RECRUITER, UserRole.ORG_ADMIN, UserRole.INSTRUCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new exam' })
  @ApiResponse({ status: 201, description: 'Exam created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async createExam(@Body() createExamDto: CreateExamDto, @Request() req) {
    // Add organizationId to the exam data
    const examDataWithOrg = {
      ...createExamDto,
      organizationId: req.user.organizationId,
    };

    return this.commandBus.execute(
      new CreateExamCommand(examDataWithOrg, req.user.id),
    );
  }

  @Get()
  @Roles(UserRole.RECRUITER, UserRole.ORG_ADMIN, UserRole.INSTRUCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all exams within your organization' })
  @ApiResponse({ status: 200, description: 'Exams retrieved successfully' })
  async getAllExams(@Request() req) {
    // Filter by organizationId instead of just createdBy
    const filter: any = { organizationId: req.user.organizationId };

    // Recruiters/Instructors can only see their own exams
    // Org Admins can see all exams in their organization
    if (req.user.role === UserRole.RECRUITER || req.user.role === UserRole.INSTRUCTOR) {
      filter.createdBy = req.user.id;
    }

    const exams = await this.examModel
      .find(filter)
      .populate('questions', 'questionText type difficulty marks')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    return {
      data: exams,
      total: exams.length,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get exam by ID' })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiResponse({ status: 200, description: 'Exam retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  async getExamById(@Param('id') id: string) {
    // Validate if the id is a valid MongoDB ObjectId
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid exam ID format');
    }

    const exam = await this.examModel
      .findById(id)
      .populate('createdBy', 'name email')
      .exec();

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // Manually populate questions since .populate() isn't working
    if (exam.questions && exam.questions.length > 0) {
      const populatedQuestions = await this.questionModel
        .find({ _id: { $in: exam.questions } })
        .exec();

      // Replace the question IDs with actual question objects
      (exam as any).questions = populatedQuestions;
    }

    return exam;
  }

  @Post(':id/questions')
  @Roles(UserRole.RECRUITER, UserRole.ORG_ADMIN, UserRole.INSTRUCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add questions to an exam' })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiResponse({ status: 200, description: 'Questions added successfully' })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not the creator' })
  async addQuestionsToExam(
    @Param('id') examId: string,
    @Body() addQuestionsDto: AddQuestionsDto,
    @Request() req,
  ) {
    if (!Types.ObjectId.isValid(examId)) {
      throw new BadRequestException('Invalid exam ID format');
    }

    return this.commandBus.execute(
      new AddQuestionsToExamCommand(examId, addQuestionsDto.questionIds, req.user.id),
    );
  }

  @Delete(':id/questions')
  @Roles(UserRole.RECRUITER, UserRole.ORG_ADMIN, UserRole.INSTRUCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove questions from an exam' })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiResponse({ status: 200, description: 'Questions removed successfully' })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not the creator' })
  async removeQuestionsFromExam(
    @Param('id') examId: string,
    @Body() removeQuestionsDto: RemoveQuestionsDto,
    @Request() req,
  ) {
    if (!Types.ObjectId.isValid(examId)) {
      throw new BadRequestException('Invalid exam ID format');
    }

    return this.commandBus.execute(
      new RemoveQuestionsFromExamCommand(examId, removeQuestionsDto.questionIds, req.user.id),
    );
  }

  @Delete(':id')
  @Roles(UserRole.RECRUITER, UserRole.ORG_ADMIN, UserRole.INSTRUCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an exam' })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiResponse({ status: 200, description: 'Exam deleted successfully' })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not the creator' })
  async deleteExam(@Param('id') examId: string, @Request() req) {
    if (!Types.ObjectId.isValid(examId)) {
      throw new BadRequestException('Invalid exam ID format');
    }

    const exam = await this.examModel.findById(examId).exec();

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // Check if user is the creator
    if (exam.createdBy.toString() !== req.user.id) {
      throw new ForbiddenException('You are not authorized to delete this exam');
    }

    // Delete the exam
    await this.examModel.findByIdAndDelete(examId).exec();

    return {
      message: 'Exam deleted successfully',
      examId,
    };
  }

  @Post(':id/enroll-students')
  @Roles(UserRole.RECRUITER, UserRole.ORG_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk enroll students to an exam' })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiResponse({
    status: 200,
    description: 'Students enrolled successfully',
    schema: {
      example: {
        message: 'Student enrollment processed',
        summary: {
          total: 10,
          enrolled: 8,
          alreadyEnrolled: 2,
          created: 5,
          errors: 0,
        },
        details: {
          enrolled: [],
          alreadyEnrolled: [],
          created: [],
          errors: [],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not the creator' })
  async enrollStudents(
    @Param('id') examId: string,
    @Body() enrollStudentsDto: EnrollStudentsDto,
    @Request() req,
  ) {
    if (!Types.ObjectId.isValid(examId)) {
      throw new BadRequestException('Invalid exam ID format');
    }

    return this.commandBus.execute(
      new EnrollStudentsCommand(examId, enrollStudentsDto, req.user.id),
    );
  }

  @Post(':id/invitations')
  @Roles(UserRole.ORG_ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send exam invitations',
    description: 'Send invitation emails with unique tokens for recruitment exams',
  })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiResponse({
    status: 200,
    description: 'Invitations sent successfully',
    schema: {
      example: {
        success: true,
        message: 'Invitations processed',
        summary: {
          total: 10,
          sent: 8,
          duplicate: 2,
          failed: 0,
          emailsQueued: 8,
        },
        details: [
          {
            email: 'candidate@example.com',
            name: 'John Doe',
            status: 'sent',
            invitationToken: '123e4567-e89b-12d3-a456-426614174000',
            invitationUrl: 'https://app.com/exam/invitation/123e4567...',
            expiresAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  @ApiResponse({ status: 400, description: 'Exam does not support invitation-based access' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async sendInvitations(
    @Param('id') examId: string,
    @Body() sendInvitationsDto: SendInvitationsDto,
    @Request() req,
  ) {
    if (!Types.ObjectId.isValid(examId)) {
      throw new BadRequestException('Invalid exam ID format');
    }

    return this.commandBus.execute(
      new SendInvitationsCommand(examId, sendInvitationsDto, req.user.id),
    );
  }

  @Get(':id/results')
  @Roles(UserRole.ORG_ADMIN, UserRole.RECRUITER, UserRole.INSTRUCTOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get exam results with analytics',
    description: 'Get comprehensive results for all participants (enrolled students and invitation-based candidates) with violation counts and statistics',
  })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiResponse({ status: 200, description: 'Results retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async getExamResults(@Param('id') examId: string, @Request() req) {
    if (!Types.ObjectId.isValid(examId)) {
      throw new BadRequestException('Invalid exam ID format');
    }

    const exam = await this.examModel.findById(examId).exec();
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // Check authorization
    if (req.user.role !== UserRole.ORG_ADMIN && exam.createdBy.toString() !== req.user.id) {
      throw new ForbiddenException('You are not authorized to view these results');
    }

    // Fetch all results for this exam
    const results = await this.resultModel
      .find({ exam: examId })
      .populate('student', 'name email phone')
      .populate('session')
      .sort({ 'scoring.totalScore': -1 })
      .exec();

    // Fetch all sessions for duration calculation
    const sessions = await this.sessionModel
      .find({ examId: examId })
      .exec();

    // Create session map for quick lookup
    const sessionMap = new Map();
    sessions.forEach(session => {
      sessionMap.set(session._id.toString(), session);
    });

    // Fetch violations grouped by session
    const violations = await this.violationModel
      .find({ exam: examId })
      .exec();

    // Group violations by session
    const violationsBySession = new Map();
    violations.forEach(violation => {
      const sessionId = violation.session.toString();
      if (!violationsBySession.has(sessionId)) {
        violationsBySession.set(sessionId, []);
      }
      violationsBySession.get(sessionId).push(violation);
    });

    // Transform results for frontend
    const transformedResults = results.map(result => {
      const session = sessionMap.get(result.session.toString());
      const sessionViolations = violationsBySession.get(result.session.toString()) || [];

      // Calculate duration
      let duration = 0;
      if (session?.startTime && session?.submittedAt) {
        duration = Math.floor((new Date(session.submittedAt).getTime() - new Date(session.startTime).getTime()) / 1000);
      }

      // Get candidate info
      let candidateName = 'Unknown';
      let candidateEmail = 'N/A';
      let candidatePhone = '';

      if (result.student) {
        const student = result.student as any;
        candidateName = student.name || 'Unknown';
        candidateEmail = student.email || 'N/A';
        candidatePhone = student.phone || '';
      } else if (result.guestCandidateInfo) {
        candidateName = result.guestCandidateInfo.name;
        candidateEmail = result.guestCandidateInfo.email;
        candidatePhone = result.guestCandidateInfo.phone || '';
      }

      return {
        _id: result._id,
        candidateName,
        candidateEmail,
        candidatePhone,
        score: result.scoring?.totalScore || 0,
        percentage: result.scoring?.percentage || 0,
        totalMarks: result.scoring?.totalMarks || (exam as any).grading?.totalMarks || 0,
        status: session?.status || 'COMPLETED',
        submittedAt: session?.submittedAt || result.submittedAt,
        duration,
        violationsCount: sessionViolations.length,
        violations: sessionViolations.map(v => ({
          type: v.type,
          severity: v.severity,
          detectedAt: v.detectedAt,
        })),
        isPassed: result.scoring?.passed || false,
      };
    });

    // Calculate statistics
    const completedResults = transformedResults.filter(r => r.status === 'COMPLETED' || r.status === 'AUTO_SUBMITTED');
    const inProgressResults = transformedResults.filter(r => r.status === 'IN_PROGRESS');

    const totalParticipants = transformedResults.length;
    const completed = completedResults.length;
    const inProgress = inProgressResults.length;
    const notStarted = 0; // For now, we only count sessions that have results

    const passed = completedResults.filter(r => r.isPassed).length;
    const failed = completedResults.filter(r => !r.isPassed).length;

    const scores = completedResults.map(r => r.percentage);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    const sortedScores = [...scores].sort((a, b) => a - b);
    const medianScore = sortedScores.length > 0
      ? sortedScores.length % 2 === 0
        ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
        : sortedScores[Math.floor(sortedScores.length / 2)]
      : 0;

    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    const durations = completedResults.map(r => r.duration).filter(d => d > 0);
    const averageDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const completionRate = totalParticipants > 0 ? (completed / totalParticipants) * 100 : 0;
    const passRate = completed > 0 ? (passed / completed) * 100 : 0;

    const totalViolations = transformedResults.reduce((sum, r) => sum + r.violationsCount, 0);
    const averageViolations = totalParticipants > 0 ? totalViolations / totalParticipants : 0;

    return {
      exam: {
        _id: exam._id,
        title: exam.title,
        code: exam.code,
        category: exam.category,
        accessMode: exam.accessMode,
        totalMarks: (exam as any).grading?.totalMarks || 0,
        passingMarks: (exam as any).grading?.passingMarks || 0,
        duration: exam.duration,
      },
      results: transformedResults,
      stats: {
        totalParticipants,
        completed,
        inProgress,
        notStarted,
        passed,
        failed,
        averageScore,
        medianScore,
        highestScore,
        lowestScore,
        averageDuration,
        completionRate,
        passRate,
        totalViolations,
        averageViolations,
      },
    };
  }
}
