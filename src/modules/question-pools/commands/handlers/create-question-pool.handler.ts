import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateQuestionPoolCommand } from '../impl/create-question-pool.command';
import {
  QuestionPool,
  QuestionPoolDocument,
} from '../../schemas/question-pool.schema';

@CommandHandler(CreateQuestionPoolCommand)
export class CreateQuestionPoolHandler
  implements ICommandHandler<CreateQuestionPoolCommand>
{
  constructor(
    @InjectModel(QuestionPool.name)
    private questionPoolModel: Model<QuestionPoolDocument>,
  ) {}

  async execute(
    command: CreateQuestionPoolCommand,
  ): Promise<QuestionPoolDocument> {
    const { createQuestionPoolDto, userId } = command;

    const newPool = new this.questionPoolModel({
      ...createQuestionPoolDto,
      createdBy: userId,
      'stats.totalQuestions': createQuestionPoolDto.questions?.length || 0,
    });

    return await newPool.save();
  }
}
