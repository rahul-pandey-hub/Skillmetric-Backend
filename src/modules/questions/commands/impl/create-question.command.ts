import { CreateQuestionDto } from '../../dto/create-question.dto';

export class CreateQuestionCommand {
  constructor(
    public readonly createQuestionDto: CreateQuestionDto,
    public readonly userId: string,
  ) {}
}
