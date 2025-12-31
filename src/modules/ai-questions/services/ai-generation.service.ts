import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  AIGeneration,
  AIProvider,
  GenerationStatus,
} from '../schemas/ai-generation.schema';
import { DifficultyLevel, QuestionCategory } from '../../questions/schemas/question.schema';
import { GenerateQuestionsDto } from '../dto';
import { PromptBuilderService } from './prompt-builder.service';
import { ResponseParserService } from './response-parser.service';
import { QuestionValidatorService } from './question-validator.service';
import { GeminiProviderService } from '../providers/gemini-provider.service';
import { ILLMProvider } from '../providers/llm-provider.interface';

@Injectable()
export class AIGenerationService {
  private readonly logger = new Logger(AIGenerationService.name);
  private currentProvider: ILLMProvider;
  private batchSize: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    @InjectModel(AIGeneration.name)
    private aiGenerationModel: Model<AIGeneration>,

    private promptBuilder: PromptBuilderService,
    private responseParser: ResponseParserService,
    private questionValidator: QuestionValidatorService,
    private geminiProvider: GeminiProviderService,
    private configService: ConfigService,
  ) {
    // Default to Gemini provider
    this.currentProvider = this.geminiProvider;

    // Load configuration
    this.batchSize = this.configService.get<number>('AI_BATCH_SIZE', 5);
    this.maxRetries = this.configService.get<number>('AI_MAX_RETRIES', 3);
    this.retryDelay = this.configService.get<number>('AI_RETRY_DELAY', 1000);
  }

  /**
   * Main question generation method
   */
  async generateQuestions(
    dto: GenerateQuestionsDto,
    userId: string,
    organizationId: string,
  ): Promise<AIGeneration> {
    this.logger.log(
      `Starting generation: ${dto.numberOfQuestions} questions on ${dto.mainTopic} - ${dto.subTopic}`,
    );

    // Create generation record
    const generation = await this.aiGenerationModel.create({
      // Request parameters
      mainTopic: dto.mainTopic,
      subTopic: dto.subTopic,
      difficulty: dto.difficulty,
      numberOfQuestions: dto.numberOfQuestions,
      questionTypes: dto.questionTypes,
      marksPerQuestion: dto.marksPerQuestion,
      additionalInstructions: dto.additionalInstructions,
      includeNegativeMarking: dto.includeNegativeMarking,
      negativeMarks: dto.negativeMarks,
      includeExplanations: dto.includeExplanations,
      includeHints: dto.includeHints,
      estimatedTime: dto.estimatedTime,
      tags: dto.tags,

      // AI provider info
      aiProvider: AIProvider.GEMINI,
      aiModel: this.currentProvider.getModel(),
      promptVersion: 'v1.0',

      // Initial status
      status: GenerationStatus.PENDING,
      requestedCount: dto.numberOfQuestions,
      generatedCount: 0,
      failedCount: 0,
      generatedQuestions: [],
      errors: [],

      // Audit
      createdBy: new Types.ObjectId(userId),
      organizationId: new Types.ObjectId(organizationId),
    });

    try {
      // Update status to in progress
      generation.status = GenerationStatus.IN_PROGRESS;
      await generation.save();

      const startTime = Date.now();
      const allQuestions = [];
      const errors = [];
      let totalTokensUsed = 0;
      let totalCost = 0;

      // Build prompts (may be batched for large requests)
      const promptContexts = this.promptBuilder.buildBatchPrompts(dto, this.batchSize);

      this.logger.log(
        `Generating ${dto.numberOfQuestions} questions in ${promptContexts.length} batch(es)`,
      );

      // Generate questions for each batch
      for (let i = 0; i < promptContexts.length; i++) {
        const context = promptContexts[i];
        this.logger.log(
          `Processing batch ${i + 1}/${promptContexts.length} (${context.batchSize} questions)`,
        );

        try {
          const batchResult = await this.generateBatch(context, i);

          allQuestions.push(...batchResult.questions);
          errors.push(...batchResult.errors);
          totalTokensUsed += batchResult.tokensUsed;
          totalCost += batchResult.cost;
        } catch (error) {
          this.logger.error(`Batch ${i + 1} failed completely`, error.stack);
          errors.push({
            questionIndex: i,
            error: `Batch generation failed: ${error.message}`,
            timestamp: new Date(),
          });
        }
      }

      // Update generation record
      const totalTime = Date.now() - startTime;

      generation.generatedQuestions = allQuestions;
      generation.generatedCount = allQuestions.length;
      generation.failedCount = dto.numberOfQuestions - allQuestions.length;
      generation.generationErrors = errors;
      generation.totalGenerationTime = totalTime;
      generation.tokensUsed = totalTokensUsed;
      generation.apiCost = totalCost;

      // Determine final status
      if (allQuestions.length === 0) {
        generation.status = GenerationStatus.FAILED;
      } else if (allQuestions.length < dto.numberOfQuestions) {
        generation.status = GenerationStatus.PARTIAL;
      } else {
        generation.status = GenerationStatus.COMPLETED;
      }

      await generation.save();

      this.logger.log(
        `Generation complete: ${allQuestions.length}/${dto.numberOfQuestions} questions in ${totalTime}ms`,
      );

      return generation;
    } catch (error) {
      this.logger.error('Generation failed critically', error.stack);

      generation.status = GenerationStatus.FAILED;
      generation.generationErrors = [
        {
          questionIndex: 0,
          error: `Critical failure: ${error.message}`,
          timestamp: new Date(),
        },
      ];
      await generation.save();

      throw error;
    }
  }

  /**
   * Generate a single batch of questions
   */
  private async generateBatch(
    context: any,
    batchIndex: number,
  ): Promise<{
    questions: any[];
    errors: any[];
    tokensUsed: number;
    cost: number;
  }> {
    const result = {
      questions: [],
      errors: [],
      tokensUsed: 0,
      cost: 0,
    };

    // Build prompt
    const builtPrompt = this.promptBuilder.buildPrompt(context);

    // Call LLM with retry logic
    const llmResponse = await this.callLLMWithRetry({
      systemPrompt: builtPrompt.systemPrompt,
      userPrompt: builtPrompt.userPrompt,
    });

    result.tokensUsed = llmResponse.tokensUsed;
    result.cost = llmResponse.cost || 0;

    // Parse response
    const parseResult = this.responseParser.parseResponse(
      llmResponse.content,
      context.questionType,
    );

    if (!parseResult.success) {
      this.logger.warn(
        `Batch ${batchIndex + 1} parsing failed: ${parseResult.errors.join(', ')}`,
      );
      result.errors.push({
        questionIndex: batchIndex,
        error: `Parsing failed: ${parseResult.errors.join(', ')}`,
        timestamp: new Date(),
      });
      return result;
    }

    // Validate questions
    for (const question of parseResult.questions) {
      try {
        const validation = await this.questionValidator.validate(question);

        if (validation.isValid && validation.qualityScore >= 50) {
          // Add AI metadata
          result.questions.push({
            ...question,
            aiMetadata: {
              model: llmResponse.model,
              promptVersion: 'v1.0',
              generationTime: llmResponse.latency,
              tokensUsed: llmResponse.tokensUsed,
              batchIndex,
              confidence: validation.qualityScore / 100,
            },
            generatedAt: new Date(),
          });
        } else {
          this.logger.warn(
            `Question rejected: ${validation.errors.join(', ')}`,
          );
          result.errors.push({
            questionIndex: result.questions.length,
            error: `Validation failed: ${validation.errors.join(', ')}`,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        this.logger.warn(`Question validation error: ${error.message}`);
        result.errors.push({
          questionIndex: result.questions.length,
          error: `Validation error: ${error.message}`,
          timestamp: new Date(),
        });
      }
    }

    return result;
  }

  /**
   * Call LLM with retry logic
   */
  private async callLLMWithRetry(request: any, attempt: number = 1): Promise<any> {
    try {
      return await this.currentProvider.generateCompletion(request);
    } catch (error) {
      this.logger.warn(`LLM call failed (attempt ${attempt}/${this.maxRetries}): ${error.message}`);

      // Check if error is retryable
      if (!this.isRetryableError(error)) {
        throw error;
      }

      // Last attempt, throw error
      if (attempt >= this.maxRetries) {
        throw new Error(`LLM call failed after ${this.maxRetries} attempts: ${error.message}`);
      }

      // Wait before retry (exponential backoff)
      const delay = this.retryDelay * Math.pow(2, attempt - 1);
      await this.sleep(delay);

      // Retry
      return this.callLLMWithRetry(request, attempt + 1);
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Retry on rate limits, timeouts, and temporary errors
    const retryableMessages = [
      'rate limit',
      'timeout',
      'temporarily unavailable',
      '429',
      '503',
      '504',
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return retryableMessages.some((msg) => errorMessage.includes(msg));
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Regenerate a specific question
   */
  async regenerateQuestion(
    generationId: string,
    questionIndex: number,
    userId: string,
    additionalInstructions?: string,
  ): Promise<any> {
    const generation = await this.aiGenerationModel.findById(generationId);

    if (!generation) {
      throw new NotFoundException('Generation not found');
    }

    if (!generation.generatedQuestions[questionIndex]) {
      throw new BadRequestException('Question not found at specified index');
    }

    const originalQuestion = generation.generatedQuestions[questionIndex];

    this.logger.log(`Regenerating question ${questionIndex} from generation ${generationId}`);

    // Build regeneration prompt
    const builtPrompt = this.promptBuilder.buildRegeneratePrompt(
      originalQuestion,
      additionalInstructions,
    );

    // Call LLM
    const llmResponse = await this.callLLMWithRetry({
      systemPrompt: builtPrompt.systemPrompt,
      userPrompt: builtPrompt.userPrompt,
    });

    // Parse response
    const parseResult = this.responseParser.parseResponse(
      llmResponse.content,
      originalQuestion.type,
    );

    if (!parseResult.success || parseResult.questions.length === 0) {
      throw new BadRequestException('Failed to regenerate question');
    }

    const newQuestion = parseResult.questions[0];

    // Validate
    const validation = await this.questionValidator.validate(newQuestion);
    if (!validation.isValid) {
      throw new BadRequestException(
        `Regenerated question validation failed: ${validation.errors.join(', ')}`,
      );
    }

    // Replace old question
    generation.generatedQuestions[questionIndex] = {
      ...newQuestion,
      difficulty: newQuestion.difficulty as DifficultyLevel,
      category: newQuestion.category as QuestionCategory,
      negativeMarks: newQuestion.negativeMarks ?? 0,
      aiMetadata: {
        model: llmResponse.model,
        promptVersion: 'v1.0',
        generationTime: llmResponse.latency,
        tokensUsed: llmResponse.tokensUsed,
        regenerated: true,
        originalQuestionId: originalQuestion.tempId,
      },
      generatedAt: new Date(),
    };

    await generation.save();

    return generation.generatedQuestions[questionIndex];
  }

  /**
   * Get generation history
   */
  async getHistory(filters: {
    organizationId: string;
    page: number;
    limit: number;
    status?: string;
    topic?: string;
  }) {
    const query: any = {
      organizationId: new Types.ObjectId(filters.organizationId),
      isActive: true,
    };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.topic) {
      query.mainTopic = filters.topic;
    }

    const total = await this.aiGenerationModel.countDocuments(query);
    const generations = await this.aiGenerationModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .populate('createdBy', 'name email')
      .exec();

    return {
      data: generations,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  /**
   * Get single generation by ID
   */
  async getGenerationById(id: string, organizationId: string) {
    const generation = await this.aiGenerationModel
      .findOne({
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
      })
      .populate('createdBy', 'name email')
      .populate('savedQuestions')
      .exec();

    if (!generation) {
      throw new NotFoundException('Generation not found');
    }

    return generation;
  }

  /**
   * Delete generation (soft delete)
   */
  async deleteGeneration(id: string, organizationId: string) {
    const result = await this.aiGenerationModel.updateOne(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
      },
      { isActive: false },
    );

    if (result.modifiedCount === 0) {
      throw new NotFoundException('Generation not found or already deleted');
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(filters: {
    organizationId: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const query: any = {
      organizationId: new Types.ObjectId(filters.organizationId),
      isActive: true,
    };

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const stats = await this.aiGenerationModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalGenerations: { $sum: 1 },
          totalQuestions: { $sum: '$generatedCount' },
          totalCost: { $sum: '$apiCost' },
          totalTime: { $sum: '$totalGenerationTime' },
          totalTokens: { $sum: '$tokensUsed' },
          averageQuestionsPerGeneration: { $avg: '$generatedCount' },
        },
      },
    ]);

    return (
      stats[0] || {
        totalGenerations: 0,
        totalQuestions: 0,
        totalCost: 0,
        totalTime: 0,
        totalTokens: 0,
        averageQuestionsPerGeneration: 0,
      }
    );
  }
}
