import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { RegenerateQuestionCommand } from '../impl';
import { AIGenerationService } from '../../services';

@CommandHandler(RegenerateQuestionCommand)
export class RegenerateQuestionHandler
  implements ICommandHandler<RegenerateQuestionCommand>
{
  private readonly logger = new Logger(RegenerateQuestionHandler.name);

  constructor(private readonly aiGenerationService: AIGenerationService) {}

  async execute(command: RegenerateQuestionCommand) {
    this.logger.log(
      `Executing RegenerateQuestionCommand for generation ${command.generationId}, question ${command.questionIndex}`,
    );

    try {
      const regeneratedQuestion = await this.aiGenerationService.regenerateQuestion(
        command.generationId,
        command.questionIndex,
        command.userId,
        command.additionalInstructions,
      );

      this.logger.log(
        `Question regenerated successfully: ${regeneratedQuestion.tempId}`,
      );

      return {
        statusCode: 200,
        message: 'Question regenerated successfully',
        data: {
          question: regeneratedQuestion,
        },
      };
    } catch (error) {
      this.logger.error('Regenerate question command failed', error.stack);
      throw error;
    }
  }
}
