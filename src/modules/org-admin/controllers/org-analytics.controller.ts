import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';
import { OrgAnalyticsService } from '../services/org-analytics.service';

@ApiTags('Organization Admin - Analytics')
@ApiBearerAuth()
@Controller('org-admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORG_ADMIN)
export class OrgAnalyticsController {
  constructor(private readonly orgAnalyticsService: OrgAnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get organization overview statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getOrganizationStats(@Request() req) {
    const organizationId = req.user.organizationId;
    return this.orgAnalyticsService.getOrganizationStats(organizationId);
  }

  @Get('departments')
  @ApiOperation({ summary: 'Get department comparison' })
  @ApiResponse({ status: 200, description: 'Department stats retrieved successfully' })
  async getDepartmentComparison(@Request() req) {
    const organizationId = req.user.organizationId;
    return this.orgAnalyticsService.getDepartmentComparison(organizationId);
  }

  @Get('batches')
  @ApiOperation({ summary: 'Get batch comparison' })
  @ApiResponse({ status: 200, description: 'Batch stats retrieved successfully' })
  async getBatchComparison(@Request() req) {
    const organizationId = req.user.organizationId;
    return this.orgAnalyticsService.getBatchComparison(organizationId);
  }

  @Get('question-bank')
  @ApiOperation({ summary: 'Get question bank analytics' })
  @ApiResponse({ status: 200, description: 'Question bank analytics retrieved successfully' })
  async getQuestionBankAnalytics(@Request() req) {
    const organizationId = req.user.organizationId;
    return this.orgAnalyticsService.getQuestionBankAnalytics(organizationId);
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Get recent activity' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default: 7)' })
  @ApiResponse({ status: 200, description: 'Recent activity retrieved successfully' })
  async getRecentActivity(@Query('days') days: number = 7, @Request() req) {
    const organizationId = req.user.organizationId;
    return this.orgAnalyticsService.getRecentActivity(organizationId, Number(days));
  }

  @Get('user-growth')
  @ApiOperation({ summary: 'Get user growth trend' })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Number of months to look back (default: 6)' })
  @ApiResponse({ status: 200, description: 'User growth trend retrieved successfully' })
  async getUserGrowthTrend(@Query('months') months: number = 6, @Request() req) {
    const organizationId = req.user.organizationId;
    return this.orgAnalyticsService.getUserGrowthTrend(organizationId, Number(months));
  }
}
