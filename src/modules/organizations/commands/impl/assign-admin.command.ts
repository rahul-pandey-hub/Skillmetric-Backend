export class AssignAdminCommand {
  constructor(
    public readonly organizationId: string,
    public readonly name: string,
    public readonly email: string,
    public readonly password?: string,
  ) {}
}
