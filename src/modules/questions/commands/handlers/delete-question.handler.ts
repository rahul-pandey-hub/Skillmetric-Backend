import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DeleteQuestionCommand } from '../impl/delete-question.command';
import { Question } from '../../schemas/question.schema';

@CommandHandler(DeleteQuestionCommand)
export class DeleteQuestionHandler
  implements ICommandHandler<DeleteQuestionCommand>
{
  constructor(
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  async execute(command: DeleteQuestionCommand) {
    const { id, userId } = command;

    // Find existing question
    const question = await this.questionModel.findById(id);
    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    // Check if user is the creator (authorization)
    // Convert both to strings for proper comparison
    const questionCreatorId = question.createdBy.toString();
    const requestUserId = userId.toString();

    if (questionCreatorId !== requestUserId) {
      throw new ForbiddenException(
        'You do not have permission to delete this question',
      );
    }

    // Soft delete by setting isActive to false
    question.isActive = false;
    await question.save();

    return {
      message: 'Question deleted successfully',
      id: question._id,
    };
  }
}
