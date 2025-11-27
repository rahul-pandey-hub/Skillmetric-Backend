export class AddQuestionsToPoolCommand {
  constructor(
    public readonly poolId: string,
    public readonly questionIds: string[],
  ) {}
}
