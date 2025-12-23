import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateQuestionCommand } from '../commands/impl/create-question.command';
import { UpdateQuestionCommand } from '../commands/impl/update-question.command';
import { DeleteQuestionCommand } from '../commands/impl/delete-question.command';
import { CreateQuestionDto } from '../dto/create-question.dto';
import { UpdateQuestionDto } from '../dto/update-question.dto';
import { Question, QuestionType, DifficultyLevel } from '../schemas/question.schema';

@ApiTags('questions')
@Controller('questions')
export class QuestionsController {
  constructor(
    private readonly commandBus: CommandBus,
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new question' })
  @ApiResponse({ status: 201, description: 'Question created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createQuestion(
    @Body() createQuestionDto: CreateQuestionDto,
    @Request() req,
  ) {
    return this.commandBus.execute(
      new CreateQuestionCommand(
        createQuestionDto,
        req.user.id,
        req.user.organizationId,
      ),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all questions with optional filters' })
  @ApiQuery({ name: 'type', enum: QuestionType, required: false })
  @ApiQuery({ name: 'difficulty', enum: DifficultyLevel, required: false })
  @ApiQuery({ name: 'category', type: String, required: false })
  @ApiQuery({ name: 'tags', type: String, required: false, description: 'Comma-separated tags' })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Questions retrieved successfully' })
  async getAllQuestions(
    @Query('type') type?: QuestionType,
    @Query('difficulty') difficulty?: DifficultyLevel,
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('isActive') isActive?: boolean,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Request() req?,
  ) {
    const filter: any = {};

    // Apply filters
    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;
    if (category) filter.category = category;
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      filter.tags = { $in: tagArray };
    }
    if (isActive !== undefined) filter.isActive = isActive;

    // Pagination
    const skip = (page - 1) * limit;

    const [questions, total] = await Promise.all([
      this.questionModel
        .find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.questionModel.countDocuments(filter),
    ]);

    return {
      data: questions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get question by ID' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: 200, description: 'Question retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async getQuestionById(@Param('id') id: string) {
    const question = await this.questionModel
      .findById(id)
      .populate('createdBy', 'name email')
      .exec();

    if (!question) {
      throw new Error('Question not found');
    }

    return question;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a question' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: 200, description: 'Question updated successfully' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not the creator' })
  async updateQuestion(
    @Param('id') id: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
    @Request() req,
  ) {
    return this.commandBus.execute(
      new UpdateQuestionCommand(id, updateQuestionDto, req.user.id),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a question (soft delete)' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: 200, description: 'Question deleted successfully' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not the creator' })
  async deleteQuestion(@Param('id') id: string, @Request() req) {
    return this.commandBus.execute(
      new DeleteQuestionCommand(id, req.user.id),
    );
  }

  @Get('stats/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get question statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getQuestionStats(@Request() req) {
    const userId = req.user.id;

    const [
      total,
      byType,
      byDifficulty,
      myQuestions,
    ] = await Promise.all([
      this.questionModel.countDocuments({ isActive: true }),
      this.questionModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      this.questionModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      ]),
      this.questionModel.countDocuments({ createdBy: userId, isActive: true }),
    ]);

    return {
      total,
      byType: byType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byDifficulty: byDifficulty.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      myQuestions,
    };
  }
}
