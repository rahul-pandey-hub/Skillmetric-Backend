import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';

/**
 * Role mapping for backward compatibility during migration period
 * Maps deprecated roles to their new equivalents
 */
const ROLE_MIGRATION_MAP: Record<string, UserRole> = {
  INSTRUCTOR: UserRole.ORG_ADMIN,
  ADMIN: UserRole.ORG_ADMIN,
  STUDENT: UserRole.CANDIDATE,
  PROCTOR: UserRole.ORG_ADMIN,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    // Get user's effective role (map deprecated roles to new ones)
    const effectiveRole = this.getEffectiveRole(user.role);

    // Check if user's effective role matches any required role
    return requiredRoles.some((requiredRole) => {
      // Also map required roles for backward compatibility
      const effectiveRequiredRole = this.getEffectiveRole(requiredRole);
      return effectiveRole === effectiveRequiredRole;
    });
  }

  /**
   * Get the effective role, mapping deprecated roles to new ones
   */
  private getEffectiveRole(role: string): UserRole {
    return ROLE_MIGRATION_MAP[role] || (role as UserRole);
  }
}
