import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateQuestionCommand } from '../impl/update-question.command';
import { Question, QuestionType } from '../../schemas/question.schema';

@CommandHandler(UpdateQuestionCommand)
export class UpdateQuestionHandler
  implements ICommandHandler<UpdateQuestionCommand>
{
  constructor(
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  async execute(command: UpdateQuestionCommand) {
    const { id, updateQuestionDto, userId } = command;

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
        'You do not have permission to update this question',
      );
    }

    // Validate correct answer if provided
    if (updateQuestionDto.correctAnswer && updateQuestionDto.options) {
      const questionType = updateQuestionDto.type || question.type;

      if (questionType === QuestionType.MULTIPLE_CHOICE) {
        const optionIds = updateQuestionDto.options.map((opt) => opt.id);
        if (!optionIds.includes(updateQuestionDto.correctAnswer)) {
          throw new BadRequestException(
            'Correct answer must match one of the option IDs',
          );
        }

        // Ensure the correct answer option is marked as correct
        const correctOption = updateQuestionDto.options.find(
          (opt) => opt.id === updateQuestionDto.correctAnswer,
        );
        if (!correctOption || !correctOption.isCorrect) {
          throw new BadRequestException(
            'The option marked as correct answer must have isCorrect: true',
          );
        }

        // Ensure only one option is marked as correct
        const correctOptions = updateQuestionDto.options.filter(
          (opt) => opt.isCorrect === true,
        );
        if (correctOptions.length !== 1) {
          throw new BadRequestException(
            'Exactly one option must be marked as correct',
          );
        }

        // Validate option IDs are unique
        const uniqueIds = new Set(optionIds);
        if (uniqueIds.size !== optionIds.length) {
          throw new BadRequestException('Option IDs must be unique');
        }
      }
    }

    // Validate negative marks if provided
    const marks = updateQuestionDto.marks || question.marks;
    const negativeMarks =
      updateQuestionDto.negativeMarks ?? question.negativeMarks;
    if (negativeMarks > marks) {
      throw new BadRequestException(
        'Negative marks cannot exceed total marks',
      );
    }

    // Update question
    Object.assign(question, updateQuestionDto);
    await question.save();

    return question.toObject();
  }
}
