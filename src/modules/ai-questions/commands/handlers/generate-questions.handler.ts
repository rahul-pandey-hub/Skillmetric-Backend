import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { GenerateQuestionsCommand } from '../impl';
import { AIGenerationService } from '../../services';

@CommandHandler(GenerateQuestionsCommand)
export class GenerateQuestionsHandler
  implements ICommandHandler<GenerateQuestionsCommand>
{
  private readonly logger = new Logger(GenerateQuestionsHandler.name);

  constructor(private readonly aiGenerationService: AIGenerationService) {}

  async execute(command: GenerateQuestionsCommand) {
    this.logger.log(
      `Executing GenerateQuestionsCommand for user ${command.userId}, org ${command.organizationId}`,
    );

    try {
      const generation = await this.aiGenerationService.generateQuestions(
        command.dto,
        command.userId,
        command.organizationId,
      );

      this.logger.log(
        `Generation completed: ${generation._id}, status: ${generation.status}`,
      );

      return {
        statusCode: 200,
        message: 'Questions generated successfully',
        data: {
          generationId: generation._id,
          status: generation.status,
          questions: generation.generatedQuestions,
          metadata: {
            requested: generation.requestedCount,
            generated: generation.generatedCount,
            failed: generation.failedCount,
            totalTime: generation.totalGenerationTime,
            cost: generation.apiCost,
          },
          errors: generation.errors,
        },
      };
    } catch (error) {
      this.logger.error('Generate questions command failed', error.stack);
      throw error;
    }
  }
}
