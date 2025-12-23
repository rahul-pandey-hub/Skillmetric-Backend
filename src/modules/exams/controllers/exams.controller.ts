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
import { CreateExamDto } from '../dto/create-exam.dto';
import { AddQuestionsDto } from '../dto/add-questions.dto';
import { RemoveQuestionsDto } from '../dto/remove-questions.dto';
import { EnrollStudentsDto } from '../dto/enroll-students.dto';
import { Exam } from '../schemas/exam.schema';

@ApiTags('exams')
@Controller('exams')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationGuard)
export class ExamsController {
  constructor(
    private readonly commandBus: CommandBus,
    @InjectModel(Exam.name) private examModel: Model<Exam>,
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
      .populate('questions')
      .populate('createdBy', 'name email')
      .exec();

    if (!exam) {
      throw new NotFoundException('Exam not found');
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
}
