import { CreateQuestionPoolDto } from '../../dto/create-question-pool.dto';

export class CreateQuestionPoolCommand {
  constructor(
    public readonly createQuestionPoolDto: CreateQuestionPoolDto,
    public readonly userId: string,
  ) {}
}
