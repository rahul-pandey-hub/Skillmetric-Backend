import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SaveAIQuestionsCommand } from '../impl';
import { AIGeneration } from '../../schemas';
import { Question } from '../../../questions/schemas/question.schema';

@CommandHandler(SaveAIQuestionsCommand)
export class SaveAIQuestionsHandler
  implements ICommandHandler<SaveAIQuestionsCommand>
{
  private readonly logger = new Logger(SaveAIQuestionsHandler.name);

  constructor(
    @InjectModel(AIGeneration.name)
    private aiGenerationModel: Model<AIGeneration>,

    @InjectModel(Question.name)
    private questionModel: Model<Question>,
  ) {}

  async execute(command: SaveAIQuestionsCommand) {
    this.logger.log(
      `Executing SaveAIQuestionsCommand for generation ${command.generationId}`,
    );

    try {
      // Find the generation
      const generation = await this.aiGenerationModel.findOne({
        _id: new Types.ObjectId(command.generationId),
        organizationId: new Types.ObjectId(command.organizationId),
      });

      if (!generation) {
        throw new NotFoundException('Generation not found');
      }

      if (!generation.generatedQuestions || generation.generatedQuestions.length === 0) {
        throw new BadRequestException('No questions available in this generation');
      }

      // Filter questions to save based on provided IDs
      const questionsToSave = generation.generatedQuestions.filter((q) =>
        command.questionIds.includes(q.tempId),
      );

      if (questionsToSave.length === 0) {
        throw new BadRequestException('None of the specified questions were found');
      }

      this.logger.log(`Saving ${questionsToSave.length} questions to question bank`);

      const savedQuestionIds: Types.ObjectId[] = [];

      // Save each question to the questions collection
      for (const generatedQuestion of questionsToSave) {
        try {
          // Transform AI question to Question schema
          const questionData = {
            text: generatedQuestion.text,
            type: generatedQuestion.type,
            difficulty: generatedQuestion.difficulty,
            category: generatedQuestion.category,
            subcategory: generatedQuestion.subcategory,
            topic: generatedQuestion.topic,
            options: generatedQuestion.options,
            correctAnswer: generatedQuestion.correctAnswer,
            explanation: generatedQuestion.explanation,
            hints: generatedQuestion.hints,
            marks: generatedQuestion.marks,
            negativeMarks: generatedQuestion.negativeMarks,
            estimatedTime: generatedQuestion.estimatedTime,
            tags: [
              ...(generatedQuestion.tags || []),
              ...(command.options?.additionalTags || []),
              'ai-generated', // Always tag as AI-generated
            ],
            codingDetails: generatedQuestion.codingDetails,

            // Add AI metadata
            aiMetadata: {
              generationId: command.generationId,
              model: generatedQuestion.aiMetadata.model,
              promptVersion: generatedQuestion.aiMetadata.promptVersion,
              generatedAt: generatedQuestion.generatedAt,
              confidence: generatedQuestion.aiMetadata.confidence,
              tokensUsed: generatedQuestion.aiMetadata.tokensUsed,
            },

            // Audit fields
            organizationId: new Types.ObjectId(command.organizationId),
            createdBy: new Types.ObjectId(command.userId),
            isActive: true,
            isPublic: command.options?.markAsPublic || false,
            isPremium: false,
          };

          // Create question in database
          const savedQuestion = await this.questionModel.create(questionData);
          savedQuestionIds.push(savedQuestion._id as Types.ObjectId);

          this.logger.log(`Saved question: ${savedQuestion._id}`);
        } catch (error) {
          this.logger.error(
            `Failed to save question ${generatedQuestion.tempId}`,
            error.stack,
          );
          // Continue with other questions even if one fails
        }
      }

      // Update generation record with saved question IDs
      generation.savedQuestions = savedQuestionIds;
      generation.savedAt = new Date();
      generation.savedBy = new Types.ObjectId(command.userId);
      await generation.save();

      // If adding to question pool, handle that
      let questionPoolId: string | undefined;
      if (command.options?.addToQuestionPool && command.options.questionPoolId) {
        // TODO: Implement question pool integration
        // This would call the existing QuestionPoolService
        questionPoolId = command.options.questionPoolId;
        this.logger.log(`Questions should be added to pool: ${questionPoolId}`);
        // await this.questionPoolService.addQuestions(questionPoolId, savedQuestionIds);
      }

      this.logger.log(`Successfully saved ${savedQuestionIds.length} questions`);

      return {
        statusCode: 200,
        message: `Successfully saved ${savedQuestionIds.length} question(s) to question bank`,
        data: {
          savedCount: savedQuestionIds.length,
          questionIds: savedQuestionIds.map((id) => id.toString()),
          questionPoolId,
        },
      };
    } catch (error) {
      this.logger.error('Save AI questions command failed', error.stack);
      throw error;
    }
  }
}
