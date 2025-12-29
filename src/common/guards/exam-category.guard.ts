import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../modules/users/schemas/user.schema';
import { ExamCategory } from '../../modules/exams/schemas/exam.schema';

export const EXAM_CATEGORIES_KEY = 'examCategories';

/**
 * Decorator to specify allowed exam categories for an endpoint
 *
 * Usage:
 * @ExamCategories(ExamCategory.RECRUITMENT)
 * @UseGuards(JwtAuthGuard, ExamCategoryGuard)
 * async createRecruitmentExam() { ... }
 */
export const ExamCategories = (...categories: ExamCategory[]) =>
  Reflect.metadata(EXAM_CATEGORIES_KEY, categories);

/**
 * Guard to enforce exam category restrictions based on user role
 *
 * Rules:
 * - RECRUITER can only create/access RECRUITMENT exams
 * - ORG_ADMIN can create/access all exam categories
 * - SUPER_ADMIN has no exam access (doesn't create exams)
 */
@Injectable()
export class ExamCategoryGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredCategories = this.reflector.get<ExamCategory[]>(
      EXAM_CATEGORIES_KEY,
      context.getHandler()
    );

    // If no categories specified, allow access
    if (!requiredCategories || requiredCategories.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // SUPER_ADMIN cannot create/manage exams
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Super Admins cannot create or manage exams'
      );
    }

    // ORG_ADMIN can access all exam categories
    if (user.role === UserRole.ORG_ADMIN) {
      return true;
    }

    // RECRUITER can only access RECRUITMENT exams
    if (user.role === UserRole.RECRUITER) {
      const canAccess = requiredCategories.includes(ExamCategory.RECRUITMENT);

      if (!canAccess) {
        throw new ForbiddenException(
          'Recruiters can only create and access recruitment exams'
        );
      }

      return true;
    }

    // CANDIDATE should not be creating exams
    if (user.role === UserRole.CANDIDATE) {
      throw new ForbiddenException('Candidates cannot create or manage exams');
    }

    // Default deny for any other role
    throw new ForbiddenException('Insufficient permissions to access this exam category');
  }
}
