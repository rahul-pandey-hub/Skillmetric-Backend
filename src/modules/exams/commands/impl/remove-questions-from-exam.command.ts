export class RemoveQuestionsFromExamCommand {
  constructor(
    public readonly examId: string,
    public readonly questionIds: string[],
    public readonly userId: string,
  ) {}
}
