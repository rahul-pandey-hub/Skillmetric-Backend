import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateQuestionCommand } from '../impl/create-question.command';
import { Question, QuestionType } from '../../schemas/question.schema';

@CommandHandler(CreateQuestionCommand)
export class CreateQuestionHandler
  implements ICommandHandler<CreateQuestionCommand>
{
  constructor(
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  async execute(command: CreateQuestionCommand) {
    const { createQuestionDto, userId, organizationId } = command;

    // Type-specific validation
    switch (createQuestionDto.type) {
      case QuestionType.MULTIPLE_CHOICE:
        this.validateMultipleChoice(createQuestionDto);
        break;

      case QuestionType.TRUE_FALSE:
        this.validateTrueFalse(createQuestionDto);
        break;

      case QuestionType.FILL_BLANK:
        this.validateFillBlank(createQuestionDto);
        break;

      case QuestionType.SHORT_ANSWER:
        this.validateShortAnswer(createQuestionDto);
        break;

      case QuestionType.ESSAY:
        this.validateEssay(createQuestionDto);
        break;

      default:
        throw new BadRequestException('Invalid question type');
    }

    // Validate negative marks don't exceed marks
    if (
      createQuestionDto.negativeMarks &&
      createQuestionDto.negativeMarks > createQuestionDto.marks
    ) {
      throw new BadRequestException(
        'Negative marks cannot exceed total marks',
      );
    }

    // Create question
    const question = new this.questionModel({
      ...createQuestionDto,
      createdBy: userId,
      organizationId: organizationId || null,
    });

    await question.save();

    return question.toObject();
  }

  private validateMultipleChoice(dto: any) {
    if (!dto.options || dto.options.length < 2) {
      throw new BadRequestException(
        'Multiple choice questions must have at least 2 options',
      );
    }

    const optionIds = dto.options.map((opt) => opt.id);

    // Validate option IDs are unique
    const uniqueIds = new Set(optionIds);
    if (uniqueIds.size !== optionIds.length) {
      throw new BadRequestException('Option IDs must be unique');
    }

    // Validate correct answer exists
    if (!dto.correctAnswer) {
      throw new BadRequestException('Correct answer is required');
    }

    // Validate correct answer matches one of the options
    if (!optionIds.includes(dto.correctAnswer)) {
      throw new BadRequestException(
        'Correct answer must match one of the option IDs',
      );
    }

    // Ensure the correct answer option is marked as correct
    const correctOption = dto.options.find(
      (opt) => opt.id === dto.correctAnswer,
    );
    if (!correctOption || !correctOption.isCorrect) {
      throw new BadRequestException(
        'The option marked as correct answer must have isCorrect: true',
      );
    }

    // Ensure only one option is marked as correct
    const correctOptions = dto.options.filter((opt) => opt.isCorrect === true);
    if (correctOptions.length !== 1) {
      throw new BadRequestException(
        'Exactly one option must be marked as correct',
      );
    }
  }

  private validateTrueFalse(dto: any) {
    if (!dto.options || dto.options.length !== 2) {
      throw new BadRequestException(
        'True/False questions must have exactly 2 options',
      );
    }

    // Validate correct answer is boolean
    if (typeof dto.correctAnswer !== 'boolean') {
      throw new BadRequestException(
        'True/False questions must have a boolean correct answer',
      );
    }

    // Ensure one option is marked as correct
    const correctOptions = dto.options.filter((opt) => opt.isCorrect === true);
    if (correctOptions.length !== 1) {
      throw new BadRequestException(
        'Exactly one option must be marked as correct',
      );
    }
  }

  private validateFillBlank(dto: any) {
    // Validate question text contains underscores
    if (!dto.text.includes('_')) {
      throw new BadRequestException(
        'Fill in the blank questions must contain underscores (_) in the question text',
      );
    }

    // Validate correct answer exists
    if (!dto.correctAnswer || dto.correctAnswer.trim() === '') {
      throw new BadRequestException(
        'Fill in the blank questions must have a correct answer',
      );
    }

    // Options should be empty or not provided
    if (dto.options && dto.options.length > 0) {
      throw new BadRequestException(
        'Fill in the blank questions should not have options',
      );
    }
  }

  private validateShortAnswer(dto: any) {
    // Validate correct answer exists (model answer)
    if (!dto.correctAnswer || dto.correctAnswer.trim() === '') {
      throw new BadRequestException(
        'Short answer questions must have a model answer',
      );
    }

    // Options should be empty or not provided
    if (dto.options && dto.options.length > 0) {
      throw new BadRequestException(
        'Short answer questions should not have options',
      );
    }
  }

  private validateEssay(dto: any) {
    // Essay questions don't require a correct answer
    // Options should be empty or not provided
    if (dto.options && dto.options.length > 0) {
      throw new BadRequestException('Essay questions should not have options');
    }
  }
}
