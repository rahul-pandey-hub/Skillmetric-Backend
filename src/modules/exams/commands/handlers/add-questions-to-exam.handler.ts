import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AddQuestionsToExamCommand } from '../impl/add-questions-to-exam.command';
import { Exam } from '../../schemas/exam.schema';
import { Question } from '../../../questions/schemas/question.schema';

@CommandHandler(AddQuestionsToExamCommand)
export class AddQuestionsToExamHandler implements ICommandHandler<AddQuestionsToExamCommand> {
  constructor(
    @InjectModel(Exam.name) private examModel: Model<Exam>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  async execute(command: AddQuestionsToExamCommand) {
    const { examId, questionIds, userId } = command;

    // Find the exam
    const exam = await this.examModel.findById(examId);
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // Check if user is the creator
    // Convert both to strings for proper comparison
    const examCreatorId = exam.createdBy.toString();
    const requestUserId = userId.toString();

    if (examCreatorId !== requestUserId) {
      throw new ForbiddenException('Only the exam creator can add questions');
    }

    // Verify all questions exist and are active
    const questions = await this.questionModel.find({
      _id: { $in: questionIds.map(id => new Types.ObjectId(id)) },
      isActive: true,
    });

    if (questions.length !== questionIds.length) {
      throw new BadRequestException('Some questions are invalid or inactive');
    }

    // Add questions to exam (avoid duplicates)
    const existingQuestionIds = exam.questions.map(q => q.toString());
    const newQuestionIds = questionIds.filter(id => !existingQuestionIds.includes(id));

    if (newQuestionIds.length === 0) {
      return {
        message: 'No new questions to add (all questions already exist in the exam)',
        exam,
      };
    }

    exam.questions.push(...newQuestionIds.map(id => new Types.ObjectId(id)));
    await exam.save();

    // Populate questions for response
    await exam.populate('questions');

    return {
      message: `${newQuestionIds.length} question(s) added successfully`,
      exam,
    };
  }
}
