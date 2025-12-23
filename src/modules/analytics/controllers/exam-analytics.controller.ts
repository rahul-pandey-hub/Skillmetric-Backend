import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ExamAnalyticsService } from '../services/exam-analytics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('analytics/exams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamAnalyticsController {
  constructor(private readonly analyticsService: ExamAnalyticsService) {}

  /**
   * GET /analytics/exams/:examId
   * Get comprehensive exam-level analytics
   * Includes: participation, scores, time, violations, shortlisting
   */
  @Get(':examId')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR', 'RECRUITER')
  async getExamAnalytics(@Param('examId') examId: string) {
    try {
      return await this.analyticsService.getExamAnalytics(examId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch exam analytics',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /analytics/exams/:examId/questions
   * Get question-level analytics
   * Success rate, average time, difficulty index per question
   */
  @Get(':examId/questions')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR', 'RECRUITER')
  async getQuestionAnalytics(@Param('examId') examId: string) {
    try {
      return await this.analyticsService.getQuestionAnalytics(examId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch question analytics',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /analytics/exams/:examId/categories
   * Get category-wise analytics
   * Performance breakdown by category
   */
  @Get(':examId/categories')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR', 'RECRUITER')
  async getCategoryAnalytics(@Param('examId') examId: string) {
    try {
      return await this.analyticsService.getCategoryAnalytics(examId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch category analytics',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /analytics/exams/:examId/complete
   * Get complete analytics (all in one)
   * Combines exam, question, and category analytics
   */
  @Get(':examId/complete')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR', 'RECRUITER')
  async getCompleteAnalytics(@Param('examId') examId: string) {
    try {
      return await this.analyticsService.getCompleteAnalytics(examId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch complete analytics',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
