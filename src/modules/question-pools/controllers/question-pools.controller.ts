import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateQuestionPoolDto } from '../dto/create-question-pool.dto';
import { UpdateQuestionPoolDto } from '../dto/update-question-pool.dto';
import { AddQuestionsDto } from '../dto/add-questions.dto';
import { CreateQuestionPoolCommand } from '../commands/impl/create-question-pool.command';
import { AddQuestionsToPoolCommand } from '../commands/impl/add-questions-to-pool.command';
import {
  QuestionPool,
  QuestionPoolDocument,
} from '../schemas/question-pool.schema';

@Controller('question-pools')
@UseGuards(JwtAuthGuard)
export class QuestionPoolsController {
  constructor(
    private readonly commandBus: CommandBus,
    @InjectModel(QuestionPool.name)
    private questionPoolModel: Model<QuestionPoolDocument>,
  ) {}

  @Post()
  async create(
    @Body() createQuestionPoolDto: CreateQuestionPoolDto,
    @Request() req,
  ) {
    const pool = await this.commandBus.execute(
      new CreateQuestionPoolCommand(createQuestionPoolDto, req.user.userId),
    );

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Question pool created successfully',
      data: pool,
    };
  }

  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('difficulty') difficulty?: string,
    @Query('organizationId') organizationId?: string,
    @Query('isPublic') isPublic?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const query: any = { isActive: true };
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (organizationId) query.organizationId = organizationId;
    if (isPublic !== undefined) query.isPublic = isPublic === 'true';

    const skip = (page - 1) * limit;

    const [pools, total] = await Promise.all([
      this.questionPoolModel
        .find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name email')
        .exec(),
      this.questionPoolModel.countDocuments(query),
    ]);

    return {
      statusCode: HttpStatus.OK,
      data: pools,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const pool = await this.questionPoolModel
      .findById(id)
      .populate('questions')
      .populate('createdBy', 'name email')
      .exec();

    if (!pool) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Question pool not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      data: pool,
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateQuestionPoolDto: UpdateQuestionPoolDto,
  ) {
    const pool = await this.questionPoolModel.findByIdAndUpdate(
      id,
      { $set: updateQuestionPoolDto },
      { new: true, runValidators: true },
    );

    if (!pool) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Question pool not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Question pool updated successfully',
      data: pool,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const pool = await this.questionPoolModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true },
    );

    if (!pool) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Question pool not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Question pool deleted successfully',
    };
  }

  @Post(':id/questions')
  async addQuestions(
    @Param('id') id: string,
    @Body() addQuestionsDto: AddQuestionsDto,
  ) {
    const pool = await this.commandBus.execute(
      new AddQuestionsToPoolCommand(id, addQuestionsDto.questionIds),
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Questions added to pool successfully',
      data: pool,
    };
  }

  @Delete(':id/questions/:questionId')
  async removeQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ) {
    const pool = await this.questionPoolModel.findByIdAndUpdate(
      id,
      {
        $pull: { questions: questionId },
      },
      { new: true },
    );

    if (!pool) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Question pool not found',
      };
    }

    // Update total questions count
    await this.questionPoolModel.findByIdAndUpdate(id, {
      $set: { 'stats.totalQuestions': pool.questions.length },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Question removed from pool successfully',
      data: pool,
    };
  }

  @Get(':id/random')
  async getRandomQuestions(
    @Param('id') id: string,
    @Query('count') count: number = 5,
  ) {
    const pool = await this.questionPoolModel
      .findById(id)
      .populate('questions')
      .exec();

    if (!pool) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Question pool not found',
      };
    }

    // Get random questions
    const shuffled = [...pool.questions].sort(() => 0.5 - Math.random());
    const randomQuestions = shuffled.slice(0, Number(count));

    return {
      statusCode: HttpStatus.OK,
      data: randomQuestions,
    };
  }
}
