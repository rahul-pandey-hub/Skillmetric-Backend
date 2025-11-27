import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateExamTemplateCommand } from '../impl/create-exam-template.command';
import {
  ExamTemplate,
  ExamTemplateDocument,
} from '../../schemas/exam-template.schema';

@CommandHandler(CreateExamTemplateCommand)
export class CreateExamTemplateHandler
  implements ICommandHandler<CreateExamTemplateCommand>
{
  constructor(
    @InjectModel(ExamTemplate.name)
    private examTemplateModel: Model<ExamTemplateDocument>,
  ) {}

  async execute(
    command: CreateExamTemplateCommand,
  ): Promise<ExamTemplateDocument> {
    const { createExamTemplateDto, userId } = command;

    const newTemplate = new this.examTemplateModel({
      ...createExamTemplateDto,
      createdBy: userId,
    });

    return await newTemplate.save();
  }
}
