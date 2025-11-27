export class DeleteQuestionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
