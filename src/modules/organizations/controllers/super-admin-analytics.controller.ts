import { Controller, Get, Query, UseGuards, ParseArrayPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';
import { AnalyticsService } from '../services/analytics.service';

@ApiTags('Super Admin - Analytics')
@ApiBearerAuth()
@Controller('super-admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SuperAdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('platform-stats')
  @ApiOperation({
    summary: 'Get platform-wide statistics',
    description:
      'Returns total counts and breakdowns of organizations, users, exams, and assessments',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform statistics retrieved successfully',
  })
  async getPlatformStats() {
    console.log('🔍 [BACKEND] getPlatformStats() called');
    const stats = await this.analyticsService.getPlatformStatistics();
    console.log('✅ [BACKEND] Platform stats fetched:', JSON.stringify(stats, null, 2));
    return stats;
  }

  @Get('top-organizations')
  @ApiOperation({
    summary: 'Get top performing organizations',
    description: 'Returns top organizations ranked by users, exams, assessments, and credits used',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of top organizations to return (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Top organizations retrieved successfully',
  })
  async getTopOrganizations(@Query('limit') limit?: number) {
    return this.analyticsService.getTopOrganizations(limit || 10);
  }

  @Get('system-health')
  @ApiOperation({
    summary: 'Get system health metrics',
    description:
      'Returns active users, active exams, recent assessments, and expiring subscriptions',
  })
  @ApiResponse({
    status: 200,
    description: 'System health metrics retrieved successfully',
  })
  async getSystemHealth() {
    return this.analyticsService.getSystemHealth();
  }

  @Get('revenue')
  @ApiOperation({
    summary: 'Get revenue analytics',
    description: 'Returns subscription breakdown and estimated revenue',
  })
  @ApiResponse({
    status: 200,
    description: 'Revenue analytics retrieved successfully',
  })
  async getRevenueAnalytics() {
    return this.analyticsService.getRevenueAnalytics();
  }

  @Get('compare-organizations')
  @ApiOperation({
    summary: 'Compare multiple organizations',
    description: 'Returns comparative data for specified organizations',
  })
  @ApiQuery({
    name: 'ids',
    required: true,
    type: [String],
    description: 'Comma-separated list of organization IDs',
    example: '60d5ec49f1b2c72b8c8e4f1a,60d5ec49f1b2c72b8c8e4f1b',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization comparison data retrieved successfully',
  })
  async compareOrganizations(
    @Query('ids', new ParseArrayPipe({ items: String, separator: ',' })) ids: string[],
  ) {
    return this.analyticsService.compareOrganizations(ids);
  }
}
