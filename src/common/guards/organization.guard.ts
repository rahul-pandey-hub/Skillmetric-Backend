import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../modules/users/schemas/user.schema';

/**
 * Guard to ensure users can only access resources within their organization
 * SUPER_ADMIN bypasses this check and can access all organizations
 */
@Injectable()
export class OrganizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // SUPER_ADMIN can access all organizations
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // All other roles must belong to an organization
    if (!user.organizationId) {
      throw new ForbiddenException(
        'Access denied. You must belong to an organization to perform this action.',
      );
    }

    // Add organizationId to request for controllers to use
    request.organizationId = user.organizationId;

    return true;
  }
}
