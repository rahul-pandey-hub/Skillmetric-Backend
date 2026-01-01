import { UserRole } from '../../modules/users/schemas/user.schema';
import { ExamCategory } from '../../modules/exams/schemas/exam.schema';

/**
 * Centralized permission logic for role-based access control
 */
export class RolePermissions {
  /**
   * Check if a role can create exams
   */
  static canCreateExams(role: UserRole): boolean {
    return [UserRole.ORG_ADMIN, UserRole.RECRUITER].includes(role);
  }

  /**
   * Check if a role can create a specific exam category
   */
  static canCreateExamCategory(role: UserRole, category: ExamCategory): boolean {
    if (role === UserRole.ORG_ADMIN) {
      return true; // Can create all categories
    }

    if (role === UserRole.RECRUITER) {
      return category === ExamCategory.RECRUITMENT; // Only recruitment
    }

    return false;
  }

  /**
   * Check if a role can enroll candidates
   */
  static canEnrollCandidates(role: UserRole): boolean {
    return role === UserRole.ORG_ADMIN;
  }

  /**
   * Check if a role can send exam invitations
   */
  static canSendInvitations(role: UserRole, examCategory?: ExamCategory): boolean {
    if (role === UserRole.ORG_ADMIN) {
      return true; // Can send for all categories
    }

    if (role === UserRole.RECRUITER) {
      // Can only send for recruitment exams
      return !examCategory || examCategory === ExamCategory.RECRUITMENT;
    }

    return false;
  }

  /**
   * Check if a role can view exam results
   */
  static canViewExamResults(role: UserRole, examCategory?: ExamCategory): boolean {
    if (role === UserRole.ORG_ADMIN) {
      return true; // Can view all results
    }

    if (role === UserRole.RECRUITER) {
      // Can only view recruitment results
      return !examCategory || examCategory === ExamCategory.RECRUITMENT;
    }

    return false;
  }

  /**
   * Check if a role can export results
   */
  static canExportResults(role: UserRole, examCategory?: ExamCategory): boolean {
    return this.canViewExamResults(role, examCategory);
  }

  /**
   * Check if a role can shortlist candidates
   */
  static canShortlistCandidates(role: UserRole): boolean {
    return [UserRole.ORG_ADMIN, UserRole.RECRUITER].includes(role);
  }

  /**
   * Check if a role can manage organizations
   */
  static canManageOrganizations(role: UserRole): boolean {
    return role === UserRole.SUPER_ADMIN;
  }

  /**
   * Check if a role can manage users
   */
  static canManageUsers(role: UserRole): boolean {
    return [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(role);
  }

  /**
   * Check if a role can create organizations
   */
  static canCreateOrganizations(role: UserRole): boolean {
    return role === UserRole.SUPER_ADMIN;
  }

  /**
   * Check if a role can delete exams
   */
  static canDeleteExams(role: UserRole): boolean {
    return role === UserRole.ORG_ADMIN;
  }

  /**
   * Check if a role can modify exam settings
   */
  static canModifyExamSettings(role: UserRole): boolean {
    return role === UserRole.ORG_ADMIN;
  }

  /**
   * Check if a role can access candidate dashboard
   */
  static canAccessCandidateDashboard(role: UserRole): boolean {
    return role === UserRole.CANDIDATE;
  }

  /**
   * Check if a role can take exams
   */
  static canTakeExams(role: UserRole): boolean {
    return role === UserRole.CANDIDATE;
  }

  /**
   * Get allowed exam categories for a role
   */
  static getAllowedExamCategories(role: UserRole): ExamCategory[] {
    switch (role) {
      case UserRole.ORG_ADMIN:
        return [
          ExamCategory.INTERNAL_ASSESSMENT,
          ExamCategory.RECRUITMENT,
          ExamCategory.GENERAL_ASSESSMENT,
        ];
      case UserRole.RECRUITER:
        return [ExamCategory.RECRUITMENT];
      default:
        return [];
    }
  }

  /**
   * Get role hierarchy level (higher number = more permissions)
   */
  static getRoleLevel(role: UserRole): number {
    const levels: Record<UserRole, number> = {
      [UserRole.SUPER_ADMIN]: 100,
      [UserRole.ORG_ADMIN]: 50,
      [UserRole.RECRUITER]: 30,
      [UserRole.CANDIDATE]: 10,
    };

    return levels[role] || 0;
  }

  /**
   * Check if roleA has higher or equal permissions than roleB
   */
  static hasHigherOrEqualPermissions(roleA: UserRole, roleB: UserRole): boolean {
    return this.getRoleLevel(roleA) >= this.getRoleLevel(roleB);
  }

  /**
   * Get user-friendly role name
   */
  static getRoleDisplayName(role: UserRole): string {
    const displayNames: Record<UserRole, string> = {
      [UserRole.SUPER_ADMIN]: 'Super Administrator',
      [UserRole.ORG_ADMIN]: 'Organization Administrator',
      [UserRole.RECRUITER]: 'Recruiter',
      [UserRole.CANDIDATE]: 'Candidate',
    };

    return displayNames[role] || role;
  }
}
