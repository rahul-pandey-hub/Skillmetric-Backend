import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { AddQuestionsToPoolCommand } from '../impl/add-questions-to-pool.command';
import {
  QuestionPool,
  QuestionPoolDocument,
} from '../../schemas/question-pool.schema';

@CommandHandler(AddQuestionsToPoolCommand)
export class AddQuestionsToPoolHandler
  implements ICommandHandler<AddQuestionsToPoolCommand>
{
  constructor(
    @InjectModel(QuestionPool.name)
    private questionPoolModel: Model<QuestionPoolDocument>,
  ) {}

  async execute(
    command: AddQuestionsToPoolCommand,
  ): Promise<QuestionPoolDocument> {
    const { poolId, questionIds } = command;

    const pool = await this.questionPoolModel.findById(poolId);

    if (!pool) {
      throw new NotFoundException(`Question pool with ID ${poolId} not found`);
    }

    // Add questions (avoiding duplicates)
    const updatedPool = await this.questionPoolModel.findByIdAndUpdate(
      poolId,
      {
        $addToSet: { questions: { $each: questionIds } },
      },
      { new: true },
    );

    // Update total questions count
    await this.questionPoolModel.findByIdAndUpdate(poolId, {
      $set: { 'stats.totalQuestions': updatedPool.questions.length },
    });

    return updatedPool;
  }
}
