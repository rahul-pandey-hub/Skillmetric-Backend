import { GenerateQuestionsDto } from '../../dto';

export class GenerateQuestionsCommand {
  constructor(
    public readonly dto: GenerateQuestionsDto,
    public readonly userId: string,
    public readonly organizationId: string,
  ) {}
}
