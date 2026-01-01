import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * FlexibleAuthGuard - Accepts both regular JWT and invitation JWT tokens
 *
 * This guard tries to authenticate using the regular JWT strategy first.
 * If that fails, it falls back to the invitation JWT strategy.
 *
 * This is useful for endpoints that need to support both:
 * - Regular authenticated users (students, admins, etc.)
 * - Guest users accessing via invitation links
 */
@Injectable()
export class FlexibleAuthGuard extends AuthGuard(['jwt', 'invitation-jwt']) {
  /**
   * This method is called when authentication succeeds with any strategy
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext, status?: any) {
    // If user is authenticated via either strategy, allow access
    if (user) {
      return user;
    }

    // If both strategies failed, throw the original error
    if (err || !user) {
      throw err || new Error('Unauthorized');
    }

    return user;
  }
}
