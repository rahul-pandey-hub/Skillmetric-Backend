import { Controller, Get, Param, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ExamMonitoringService } from '../services/exam-monitoring.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamMonitoringController {
  constructor(private readonly monitoringService: ExamMonitoringService) {}

  /**
   * GET /monitoring/exams/:examId/live
   * Get real-time statistics for an active exam
   */
  @Get('exams/:examId/live')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'RECRUITER')
  async getLiveExamStats(@Param('examId') examId: string) {
    try {
      return await this.monitoringService.getLiveExamStats(examId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch live exam stats',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /monitoring/exams/active
   * Get all currently active exams
   */
  @Get('exams/active')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'RECRUITER')
  async getActiveExams() {
    try {
      return await this.monitoringService.getActiveExams();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch active exams',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /monitoring/violations
   * GET /monitoring/violations?examId=xxx
   * Get violation alerts across all exams or specific exam
   */
  @Get('violations')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'RECRUITER')
  async getViolationAlerts(@Param('examId') examId?: string) {
    try {
      return await this.monitoringService.getViolationAlerts(examId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch violation alerts',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /monitoring/system/stats
   * Get system-wide monitoring statistics
   */
  @Get('system/stats')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  async getSystemStats() {
    try {
      return await this.monitoringService.getSystemStats();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch system stats',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /monitoring/sessions/:sessionId
   * Get detailed information about a specific exam session
   */
  @Get('sessions/:sessionId')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'RECRUITER')
  async getCandidateSession(@Param('sessionId') sessionId: string) {
    try {
      return await this.monitoringService.getCandidateSession(sessionId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch session details',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
