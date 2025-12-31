export class RegenerateQuestionCommand {
  constructor(
    public readonly generationId: string,
    public readonly questionIndex: number,
    public readonly userId: string,
    public readonly additionalInstructions?: string,
  ) {}
}
