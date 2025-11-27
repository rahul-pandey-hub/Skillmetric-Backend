import { UserRole } from '../../../users/schemas/user.schema';

export class RegisterCommand {
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly password: string,
    public readonly role: UserRole,
    public readonly studentId?: string,
  ) {}
}
