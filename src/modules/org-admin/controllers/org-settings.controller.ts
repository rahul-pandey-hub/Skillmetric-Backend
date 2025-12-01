import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';
import { OrgSettingsService } from '../services/org-settings.service';
import { UpdateOrgSettingsDto } from '../dto/org-settings.dto';

@ApiTags('Organization Admin - Settings')
@ApiBearerAuth()
@Controller('org-admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORG_ADMIN)
export class OrgSettingsController {
  constructor(private readonly orgSettingsService: OrgSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get organization settings' })
  @ApiResponse({ status: 200, description: 'Organization settings retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async getOrganizationSettings(@Request() req) {
    const organizationId = req.user.organizationId;
    return this.orgSettingsService.getOrganizationSettings(organizationId);
  }

  @Put()
  @ApiOperation({ summary: 'Update organization settings' })
  @ApiResponse({ status: 200, description: 'Organization settings updated successfully' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async updateOrganizationSettings(
    @Body() dto: UpdateOrgSettingsDto,
    @Request() req,
  ) {
    const organizationId = req.user.organizationId;
    return this.orgSettingsService.updateOrganizationSettings(organizationId, dto);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get organization usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async getOrganizationUsage(@Request() req) {
    const organizationId = req.user.organizationId;
    return this.orgSettingsService.getOrganizationUsage(organizationId);
  }
}
