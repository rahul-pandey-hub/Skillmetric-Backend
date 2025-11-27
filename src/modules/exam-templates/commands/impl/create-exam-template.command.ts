import { CreateExamTemplateDto } from '../../dto/create-exam-template.dto';

export class CreateExamTemplateCommand {
  constructor(
    public readonly createExamTemplateDto: CreateExamTemplateDto,
    public readonly userId: string,
  ) {}
}
