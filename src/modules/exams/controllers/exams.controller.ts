import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
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
export class ExamsController {
  constructor(
    private readonly commandBus: CommandBus,
    @InjectModel(Exam.name) private examModel: Model<Exam>,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new exam' })
  async createExam(@Body() createExamDto: CreateExamDto, @Request() req) {
    return this.commandBus.execute(
      new CreateExamCommand(createExamDto, req.user.id),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all exams created by the admin' })
  @ApiResponse({ status: 200, description: 'Exams retrieved successfully' })
  async getAllExams(@Request() req) {
    const exams = await this.examModel
      .find({ createdBy: req.user.id })
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
    const exam = await this.examModel
      .findById(id)
      .populate('questions')
      .populate('createdBy', 'name email')
      .exec();

    if (!exam) {
      throw new Error('Exam not found');
    }

    return exam;
  }

  @Post(':id/questions')
  @UseGuards(JwtAuthGuard)
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
    return this.commandBus.execute(
      new AddQuestionsToExamCommand(examId, addQuestionsDto.questionIds, req.user.id),
    );
  }

  @Delete(':id/questions')
  @UseGuards(JwtAuthGuard)
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
    return this.commandBus.execute(
      new RemoveQuestionsFromExamCommand(examId, removeQuestionsDto.questionIds, req.user.id),
    );
  }

  @Post(':id/enroll-students')
  @UseGuards(JwtAuthGuard)
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
    return this.commandBus.execute(
      new EnrollStudentsCommand(examId, enrollStudentsDto, req.user.id),
    );
  }
}
