import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { InvitationTokenService } from '../../modules/exams/services/invitation-token.service';

/**
 * Guard to validate invitation token from request parameters
 * Attaches invitation data to request object for downstream use
 *
 * Usage:
 * @UseGuards(InvitationAccessGuard)
 * async accessExam(@Param('token') token: string, @Request() req) {
 *   // req.invitation and req.invitationId are now available
 * }
 */
@Injectable()
export class InvitationAccessGuard implements CanActivate {
  constructor(
    private readonly invitationTokenService: InvitationTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract token from params or query
    const token = request.params.token || request.query.token;

    if (!token) {
      throw new UnauthorizedException('Invitation token is required');
    }

    try {
      // Validate token and track access
      const invitation = await this.invitationTokenService.validateToken(token);

      // Attach invitation to request for downstream controllers
      request.invitation = invitation;
      request.invitationId = invitation._id.toString();

      return true;
    } catch (error) {
      // Re-throw with clearer message
      throw new UnauthorizedException(
        error.message || 'Invalid or expired invitation token'
      );
    }
  }
}
