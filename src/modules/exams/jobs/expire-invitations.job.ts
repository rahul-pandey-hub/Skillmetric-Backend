import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvitationTokenService } from '../services/invitation-token.service';

/**
 * Background job to automatically expire invitations that are past their expiry date
 *
 * Runs every 6 hours to check for and expire invitations
 */
@Injectable()
export class ExpireInvitationsJob {
  private readonly logger = new Logger(ExpireInvitationsJob.name);

  constructor(
    private readonly invitationTokenService: InvitationTokenService,
  ) {}

  /**
   * Run every 6 hours
   * Can be customized using cron expression:
   * - '0 *\/6 * * *' = Every 6 hours
   * - '0 0 * * *' = Daily at midnight
   * - '0 *\/1 * * *' = Every hour
   */
  @Cron('0 */6 * * *', {
    name: 'expire-invitations',
    timeZone: 'UTC',
  })
  async handleExpiredInvitations() {
    this.logger.log('Starting invitation expiry job...');

    try {
      const expiredCount =
        await this.invitationTokenService.expireExpiredInvitations();

      if (expiredCount > 0) {
        this.logger.log(`Expired ${expiredCount} invitation(s)`);
      } else {
        this.logger.log('No invitations to expire');
      }
    } catch (error) {
      this.logger.error('Error expiring invitations:', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Manual trigger for expiring invitations
   * Can be called by admin endpoint or during deployment
   */
  async manualTrigger(): Promise<number> {
    this.logger.log('Manual trigger: Expiring invitations...');
    const expiredCount =
      await this.invitationTokenService.expireExpiredInvitations();
    this.logger.log(`Manually expired ${expiredCount} invitation(s)`);
    return expiredCount;
  }
}
