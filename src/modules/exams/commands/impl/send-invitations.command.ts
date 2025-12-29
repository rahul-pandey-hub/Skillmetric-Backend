import { SendInvitationsDto } from '../../dto/send-invitations.dto';

export class SendInvitationsCommand {
  constructor(
    public readonly examId: string,
    public readonly sendInvitationsDto: SendInvitationsDto,
    public readonly userId: string, // Who is sending the invitations
  ) {}
}
