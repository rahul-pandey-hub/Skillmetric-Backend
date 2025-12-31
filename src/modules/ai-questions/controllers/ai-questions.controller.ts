import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  GenerateQuestionsDto,
  SaveQuestionsDto,
  RegenerateQuestionDto,
} from '../dto';
import {
  GenerateQuestionsCommand,
  SaveAIQuestionsCommand,
  RegenerateQuestionCommand,
} from '../commands';
import { AIGenerationService } from '../services';

@Controller('ai-questions')
@UseGuards(JwtAuthGuard)
export class AIQuestionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly aiGenerationService: AIGenerationService,
  ) {}

  /**
   * POST /api/v1/ai-questions/generate
   * Generate questions using AI
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateQuestions(
    @Body() dto: GenerateQuestionsDto,
    @Request() req,
  ) {
    const command = new GenerateQuestionsCommand(
      dto,
      req.user.userId,
      req.user.organizationId,
    );

    return await this.commandBus.execute(command);
  }

  /**
   * POST /api/v1/ai-questions/:id/regenerate/:questionIndex
   * Regenerate a specific question
   */
  @Post(':id/regenerate/:questionIndex')
  @HttpCode(HttpStatus.OK)
  async regenerateQuestion(
    @Param('id') generationId: string,
    @Param('questionIndex', ParseIntPipe) questionIndex: number,
    @Body() dto: RegenerateQuestionDto,
    @Request() req,
  ) {
    const command = new RegenerateQuestionCommand(
      generationId,
      questionIndex,
      req.user.userId,
      dto.additionalInstructions,
    );

    return await this.commandBus.execute(command);
  }

  /**
   * POST /api/v1/ai-questions/:id/save
   * Save approved questions to question bank
   */
  @Post(':id/save')
  @HttpCode(HttpStatus.OK)
  async saveQuestions(
    @Param('id') generationId: string,
    @Body() dto: SaveQuestionsDto,
    @Request() req,
  ) {
    const command = new SaveAIQuestionsCommand(
      generationId,
      dto.questionIds,
      dto.options || {},
      req.user.userId,
      req.user.organizationId,
    );

    return await this.commandBus.execute(command);
  }

  /**
   * GET /api/v1/ai-questions/history
   * Get generation history
   */
  @Get('history')
  async getHistory(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('topic') topic?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const result = await this.aiGenerationService.getHistory({
      organizationId: req.user.organizationId,
      page: pageNum,
      limit: limitNum,
      status,
      topic,
    });

    return {
      statusCode: 200,
      message: 'Generation history retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  /**
   * GET /api/v1/ai-questions/:id
   * Get single generation by ID
   */
  @Get(':id')
  async getGeneration(@Param('id') id: string, @Request() req) {
    const generation = await this.aiGenerationService.getGenerationById(
      id,
      req.user.organizationId,
    );

    return {
      statusCode: 200,
      message: 'Generation retrieved successfully',
      data: generation,
    };
  }

  /**
   * POST /api/v1/ai-questions/:id/retry
   * Retry failed generation
   */
  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  async retryGeneration(@Param('id') id: string, @Request() req) {
    // Get the original generation
    const originalGeneration = await this.aiGenerationService.getGenerationById(
      id,
      req.user.organizationId,
    );

    // Create new generation with same parameters
    const dto: GenerateQuestionsDto = {
      mainTopic: originalGeneration.mainTopic,
      subTopic: originalGeneration.subTopic,
      difficulty: originalGeneration.difficulty,
      numberOfQuestions: originalGeneration.numberOfQuestions,
      questionTypes: originalGeneration.questionTypes,
      marksPerQuestion: originalGeneration.marksPerQuestion,
      additionalInstructions: originalGeneration.additionalInstructions,
      includeNegativeMarking: originalGeneration.includeNegativeMarking,
      negativeMarks: originalGeneration.negativeMarks,
      includeExplanations: originalGeneration.includeExplanations,
      includeHints: originalGeneration.includeHints,
      estimatedTime: originalGeneration.estimatedTime,
      tags: originalGeneration.tags,
    };

    const command = new GenerateQuestionsCommand(
      dto,
      req.user.userId,
      req.user.organizationId,
    );

    return await this.commandBus.execute(command);
  }

  /**
   * DELETE /api/v1/ai-questions/:id
   * Delete generation record (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGeneration(@Param('id') id: string, @Request() req) {
    await this.aiGenerationService.deleteGeneration(
      id,
      req.user.organizationId,
    );
  }

  /**
   * GET /api/v1/ai-questions/stats/usage
   * Get AI generation usage statistics
   */
  @Get('stats/usage')
  async getUsageStats(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const stats = await this.aiGenerationService.getUsageStats({
      organizationId: req.user.organizationId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return {
      statusCode: 200,
      message: 'Usage statistics retrieved successfully',
      data: stats,
    };
  }
}
