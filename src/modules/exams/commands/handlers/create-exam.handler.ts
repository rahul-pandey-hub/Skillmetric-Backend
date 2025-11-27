import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateExamCommand } from '../impl/create-exam.command';
import { Exam, ExamStatus } from '../../schemas/exam.schema';

@CommandHandler(CreateExamCommand)
export class CreateExamHandler implements ICommandHandler<CreateExamCommand> {
  constructor(@InjectModel(Exam.name) private examModel: Model<Exam>) {}

  async execute(command: CreateExamCommand) {
    const { createExamDto, userId } = command;

    // Check if exam code already exists
    const existingExam = await this.examModel.findOne({ code: createExamDto.code });
    if (existingExam) {
      throw new ConflictException('An exam with this code already exists');
    }

    // Validate schedule dates
    if (createExamDto.schedule.startDate >= createExamDto.schedule.endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate grading
    if (createExamDto.grading.passingMarks > createExamDto.grading.totalMarks) {
      throw new BadRequestException('Passing marks cannot be greater than total marks');
    }

    // Create exam
    const exam = new this.examModel({
      ...createExamDto,
      createdBy: userId,
      status: createExamDto.status || ExamStatus.DRAFT,
      questions: createExamDto.questions || [],
      enrolledStudents: createExamDto.enrolledStudents || [],
    });

    await exam.save();

    return {
      id: exam._id,
      title: exam.title,
      code: exam.code,
      description: exam.description,
      duration: exam.duration,
      status: exam.status,
      proctoringSettings: exam.proctoringSettings,
      schedule: exam.schedule,
      grading: exam.grading,
      settings: exam.settings,
      createdBy: exam.createdBy,
      questions: exam.questions,
      enrolledStudents: exam.enrolledStudents,
    };
  }
}
