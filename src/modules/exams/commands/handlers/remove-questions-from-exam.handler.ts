import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RemoveQuestionsFromExamCommand } from '../impl/remove-questions-from-exam.command';
import { Exam } from '../../schemas/exam.schema';
import { Question } from '../../../questions/schemas/question.schema';

@CommandHandler(RemoveQuestionsFromExamCommand)
export class RemoveQuestionsFromExamHandler implements ICommandHandler<RemoveQuestionsFromExamCommand> {
  constructor(
    @InjectModel(Exam.name) private examModel: Model<Exam>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  async execute(command: RemoveQuestionsFromExamCommand) {
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
      throw new ForbiddenException('Only the exam creator can remove questions');
    }

    // Remove questions from exam
    exam.questions = exam.questions.filter(
      q => !questionIds.includes(q.toString())
    );

    // Recalculate total marks from remaining questions
    const remainingQuestions = await this.questionModel.find({
      _id: { $in: exam.questions }
    });

    exam.grading.totalMarks = remainingQuestions.reduce(
      (sum, q) => sum + (q.marks || 0),
      0
    );
    exam.totalQuestions = remainingQuestions.length;

    await exam.save();

    // Populate questions for response
    await exam.populate('questions');

    return {
      message: 'Questions removed successfully',
      totalQuestions: exam.totalQuestions,
      totalMarks: exam.grading.totalMarks,
      exam,
    };
  }
}
