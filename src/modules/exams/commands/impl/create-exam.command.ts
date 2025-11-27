import { CreateExamDto } from '../../dto/create-exam.dto';

export class CreateExamCommand {
  constructor(
    public readonly createExamDto: CreateExamDto,
    public readonly userId: string,
  ) {}
}
