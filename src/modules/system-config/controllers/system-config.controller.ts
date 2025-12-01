import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';
import { SystemConfigService } from '../services/system-config.service';
import {
  CreateExamTemplateDto,
  UpdateExamTemplateDto,
} from '../dto/create-exam-template.dto';
import {
  CreateQuestionPoolDto,
  UpdateQuestionPoolDto,
  AddQuestionsToPoolDto,
} from '../dto/create-question-pool.dto';
import {
  CreateSystemCertificationDto,
  UpdateSystemCertificationDto,
} from '../dto/create-system-certification.dto';
import {
  CreatePricingPlanDto,
  UpdatePricingPlanDto,
} from '../dto/create-pricing-plan.dto';

@ApiTags('Super Admin - System Configuration')
@ApiBearerAuth()
@Controller('super-admin/system-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  // ===== EXAM TEMPLATES =====
  @Post('templates')
  @ApiOperation({ summary: 'Create exam template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createExamTemplate(@Body() dto: CreateExamTemplateDto) {
    return this.systemConfigService.createExamTemplate(dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all exam templates' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getAllExamTemplates(@Query('isActive') isActive?: boolean) {
    const filter = isActive !== undefined ? { isActive } : {};
    return this.systemConfigService.getAllExamTemplates(filter);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get exam template by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  async getExamTemplateById(@Param('id') id: string) {
    return this.systemConfigService.getExamTemplateById(id);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update exam template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async updateExamTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateExamTemplateDto,
  ) {
    return this.systemConfigService.updateExamTemplate(id, dto);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete exam template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 204, description: 'Template deleted successfully' })
  async deleteExamTemplate(@Param('id') id: string) {
    return this.systemConfigService.deleteExamTemplate(id);
  }

  // ===== QUESTION POOLS =====
  @Post('question-pools')
  @ApiOperation({ summary: 'Create question pool' })
  @ApiResponse({ status: 201, description: 'Pool created successfully' })
  async createQuestionPool(@Body() dto: CreateQuestionPoolDto, @Req() req) {
    return this.systemConfigService.createQuestionPool(dto, req.user.userId);
  }

  @Get('question-pools')
  @ApiOperation({ summary: 'Get all question pools' })
  @ApiQuery({ name: 'visibility', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Pools retrieved successfully' })
  async getAllQuestionPools(
    @Query('visibility') visibility?: string,
    @Query('isActive') isActive?: boolean,
  ) {
    const filter: any = {};
    if (visibility) filter.visibility = visibility;
    if (isActive !== undefined) filter.isActive = isActive;
    return this.systemConfigService.getAllQuestionPools(filter);
  }

  @Get('question-pools/:id')
  @ApiOperation({ summary: 'Get question pool by ID' })
  @ApiParam({ name: 'id', description: 'Pool ID' })
  @ApiResponse({ status: 200, description: 'Pool retrieved successfully' })
  async getQuestionPoolById(@Param('id') id: string) {
    return this.systemConfigService.getQuestionPoolById(id);
  }

  @Put('question-pools/:id')
  @ApiOperation({ summary: 'Update question pool' })
  @ApiParam({ name: 'id', description: 'Pool ID' })
  @ApiResponse({ status: 200, description: 'Pool updated successfully' })
  async updateQuestionPool(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionPoolDto,
  ) {
    return this.systemConfigService.updateQuestionPool(id, dto);
  }

  @Delete('question-pools/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete question pool' })
  @ApiParam({ name: 'id', description: 'Pool ID' })
  @ApiResponse({ status: 204, description: 'Pool deleted successfully' })
  async deleteQuestionPool(@Param('id') id: string) {
    return this.systemConfigService.deleteQuestionPool(id);
  }

  @Post('question-pools/:id/questions')
  @ApiOperation({ summary: 'Add questions to pool' })
  @ApiParam({ name: 'id', description: 'Pool ID' })
  @ApiResponse({ status: 200, description: 'Questions added successfully' })
  async addQuestionsToPool(
    @Param('id') id: string,
    @Body() dto: AddQuestionsToPoolDto,
  ) {
    return this.systemConfigService.addQuestionsToPool(id, dto.questionIds);
  }

  // ===== SYSTEM CERTIFICATIONS =====
  @Post('certifications')
  @ApiOperation({ summary: 'Create system certification' })
  @ApiResponse({
    status: 201,
    description: 'Certification created successfully',
  })
  async createSystemCertification(@Body() dto: CreateSystemCertificationDto) {
    return this.systemConfigService.createSystemCertification(dto);
  }

  @Get('certifications')
  @ApiOperation({ summary: 'Get all system certifications' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Certifications retrieved successfully',
  })
  async getAllSystemCertifications(@Query('isActive') isActive?: boolean) {
    const filter = isActive !== undefined ? { isActive } : {};
    return this.systemConfigService.getAllSystemCertifications(filter);
  }

  @Get('certifications/:id')
  @ApiOperation({ summary: 'Get system certification by ID' })
  @ApiParam({ name: 'id', description: 'Certification ID' })
  @ApiResponse({
    status: 200,
    description: 'Certification retrieved successfully',
  })
  async getSystemCertificationById(@Param('id') id: string) {
    return this.systemConfigService.getSystemCertificationById(id);
  }

  @Put('certifications/:id')
  @ApiOperation({ summary: 'Update system certification' })
  @ApiParam({ name: 'id', description: 'Certification ID' })
  @ApiResponse({
    status: 200,
    description: 'Certification updated successfully',
  })
  async updateSystemCertification(
    @Param('id') id: string,
    @Body() dto: UpdateSystemCertificationDto,
  ) {
    return this.systemConfigService.updateSystemCertification(id, dto);
  }

  @Delete('certifications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete system certification' })
  @ApiParam({ name: 'id', description: 'Certification ID' })
  @ApiResponse({
    status: 204,
    description: 'Certification deleted successfully',
  })
  async deleteSystemCertification(@Param('id') id: string) {
    return this.systemConfigService.deleteSystemCertification(id);
  }

  // ===== PRICING PLANS =====
  @Post('pricing-plans')
  @ApiOperation({ summary: 'Create pricing plan' })
  @ApiResponse({ status: 201, description: 'Plan created successfully' })
  async createPricingPlan(@Body() dto: CreatePricingPlanDto) {
    return this.systemConfigService.createPricingPlan(dto);
  }

  @Get('pricing-plans')
  @ApiOperation({ summary: 'Get all pricing plans' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isPublic', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Plans retrieved successfully' })
  async getAllPricingPlans(
    @Query('isActive') isActive?: boolean,
    @Query('isPublic') isPublic?: boolean,
  ) {
    const filter: any = {};
    if (isActive !== undefined) filter.isActive = isActive;
    if (isPublic !== undefined) filter.isPublic = isPublic;
    return this.systemConfigService.getAllPricingPlans(filter);
  }

  @Get('pricing-plans/public')
  @ApiOperation({ summary: 'Get public pricing plans (no auth required)' })
  @ApiResponse({ status: 200, description: 'Public plans retrieved successfully' })
  async getPublicPricingPlans() {
    return this.systemConfigService.getPublicPricingPlans();
  }

  @Get('pricing-plans/:id')
  @ApiOperation({ summary: 'Get pricing plan by ID' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({ status: 200, description: 'Plan retrieved successfully' })
  async getPricingPlanById(@Param('id') id: string) {
    return this.systemConfigService.getPricingPlanById(id);
  }

  @Put('pricing-plans/:id')
  @ApiOperation({ summary: 'Update pricing plan' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({ status: 200, description: 'Plan updated successfully' })
  async updatePricingPlan(
    @Param('id') id: string,
    @Body() dto: UpdatePricingPlanDto,
  ) {
    return this.systemConfigService.updatePricingPlan(id, dto);
  }

  @Delete('pricing-plans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete pricing plan' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({ status: 204, description: 'Plan deleted successfully' })
  async deletePricingPlan(@Param('id') id: string) {
    return this.systemConfigService.deletePricingPlan(id);
  }
}
