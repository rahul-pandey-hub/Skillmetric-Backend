import { SaveOptionsDto } from '../../dto';

export class SaveAIQuestionsCommand {
  constructor(
    public readonly generationId: string,
    public readonly questionIds: string[],
    public readonly options: SaveOptionsDto,
    public readonly userId: string,
    public readonly organizationId: string,
  ) {}
}
