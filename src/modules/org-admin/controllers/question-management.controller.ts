import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';
import { QuestionManagementService } from '../services/question-management.service';
import {
  CreateQuestionDto,
  BulkCreateQuestionsDto,
  UpdateQuestionDto,
  QuestionFiltersDto,
} from '../dto/create-question.dto';

@ApiTags('Organization Admin - Question Management')
@ApiBearerAuth()
@Controller('org-admin/questions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORG_ADMIN)
export class QuestionManagementController {
  constructor(private readonly questionManagementService: QuestionManagementService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new question' })
  @ApiResponse({ status: 201, description: 'Question created successfully' })
  async createQuestion(@Body() dto: CreateQuestionDto, @Request() req) {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    return this.questionManagementService.createQuestion(dto, organizationId, userId);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk create questions' })
  @ApiResponse({ status: 201, description: 'Bulk creation completed' })
  async bulkCreateQuestions(@Body() dto: BulkCreateQuestionsDto, @Request() req) {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    return this.questionManagementService.bulkCreateQuestions(dto.questions, organizationId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all questions with filters' })
  @ApiResponse({ status: 200, description: 'Questions retrieved successfully' })
  async getAllQuestions(@Query() filters: QuestionFiltersDto, @Request() req) {
    const organizationId = req.user.organizationId;
    return this.questionManagementService.getAllQuestions(filters, organizationId);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get question bank statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getQuestionStatistics(@Request() req) {
    const organizationId = req.user.organizationId;
    return this.questionManagementService.getQuestionStatistics(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get question by ID' })
  @ApiResponse({ status: 200, description: 'Question retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async getQuestionById(@Param('id') id: string, @Request() req) {
    const organizationId = req.user.organizationId;
    return this.questionManagementService.getQuestionById(id, organizationId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update question' })
  @ApiResponse({ status: 200, description: 'Question updated successfully' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async updateQuestion(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
    @Request() req,
  ) {
    const organizationId = req.user.organizationId;
    return this.questionManagementService.updateQuestion(id, dto, organizationId);
  }

  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Toggle question active status' })
  @ApiResponse({ status: 200, description: 'Question status toggled successfully' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async toggleQuestionStatus(@Param('id') id: string, @Request() req) {
    const organizationId = req.user.organizationId;
    return this.questionManagementService.toggleQuestionStatus(id, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete question' })
  @ApiResponse({ status: 200, description: 'Question deleted successfully' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async deleteQuestion(@Param('id') id: string, @Request() req) {
    const organizationId = req.user.organizationId;
    return this.questionManagementService.deleteQuestion(id, organizationId);
  }
}
