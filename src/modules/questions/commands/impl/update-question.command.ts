import { UpdateQuestionDto } from '../../dto/update-question.dto';

export class UpdateQuestionCommand {
  constructor(
    public readonly id: string,
    public readonly updateQuestionDto: UpdateQuestionDto,
    public readonly userId: string,
  ) {}
}
