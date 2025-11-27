export class AddQuestionsToExamCommand {
  constructor(
    public readonly examId: string,
    public readonly questionIds: string[],
    public readonly userId: string,
  ) {}
}
