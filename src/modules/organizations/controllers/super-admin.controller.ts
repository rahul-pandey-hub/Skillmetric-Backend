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
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
import { Organization } from '../schemas/organization.schema';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { AssignAdminDto } from '../dto/assign-admin.dto';
import { OrganizationFilterDto } from '../dto/organization-filter.dto';
import { CreateOrganizationCommand } from '../commands/impl/create-organization.command';
import { UpdateOrganizationCommand } from '../commands/impl/update-organization.command';
import { AssignAdminCommand } from '../commands/impl/assign-admin.command';
import { SuspendOrganizationCommand } from '../commands/impl/suspend-organization.command';
import { ActivateOrganizationCommand } from '../commands/impl/activate-organization.command';

@ApiTags('Super Admin - Organizations')
@ApiBearerAuth()
@Controller('super-admin/organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SuperAdminController {
  constructor(
    private readonly commandBus: CommandBus,
    @InjectModel(Organization.name)
    private organizationModel: Model<Organization>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({
    status: 201,
    description: 'Organization created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - SUPER_ADMIN only' })
  async create(@Body() createDto: CreateOrganizationDto) {
    return this.commandBus.execute(new CreateOrganizationCommand(createDto));
  }

  @Get()
  @ApiOperation({ summary: 'Get all organizations with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Organizations retrieved successfully' })
  async findAll(@Query() filterDto: OrganizationFilterDto) {
    const { type, status, plan, search, page = 1, limit = 10 } = filterDto;

    const filter: any = {};

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (plan) filter['subscription.plan'] = plan;
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [organizations, total] = await Promise.all([
      this.organizationModel
        .find(filter)
        .populate('admins', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.organizationModel.countDocuments(filter),
    ]);

    return {
      data: organizations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findOne(@Param('id') id: string) {
    const organization = await this.organizationModel
      .findById(id)
      .populate('admins', 'name email role isActive lastLogin')
      .exec();

    if (!organization) {
      throw new Error('Organization not found');
    }

    return organization;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization updated successfully' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateOrganizationDto) {
    return this.commandBus.execute(new UpdateOrganizationCommand(id, updateDto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 204, description: 'Organization deleted successfully' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async delete(@Param('id') id: string) {
    const organization = await this.organizationModel.findByIdAndDelete(id);
    if (!organization) {
      throw new Error('Organization not found');
    }
    return;
  }

  @Post(':id/assign-admin')
  @ApiOperation({ summary: 'Assign an admin to an organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({
    status: 201,
    description: 'Admin assigned successfully',
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async assignAdmin(@Param('id') id: string, @Body() assignAdminDto: AssignAdminDto) {
    return this.commandBus.execute(
      new AssignAdminCommand(
        id,
        assignAdminDto.name,
        assignAdminDto.email,
        assignAdminDto.password,
      ),
    );
  }

  @Put(':id/suspend')
  @ApiOperation({ summary: 'Suspend an organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization suspended successfully' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async suspend(@Param('id') id: string) {
    return this.commandBus.execute(new SuspendOrganizationCommand(id));
  }

  @Put(':id/activate')
  @ApiOperation({ summary: 'Activate a suspended organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization activated successfully' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async activate(@Param('id') id: string) {
    return this.commandBus.execute(new ActivateOrganizationCommand(id));
  }

  @Get(':id/usage')
  @ApiOperation({ summary: 'Get organization usage statistics' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  async getUsageStats(@Param('id') id: string) {
    const organization = await this.organizationModel.findById(id).exec();
    if (!organization) {
      throw new Error('Organization not found');
    }

    return {
      organizationId: organization._id,
      organizationName: organization.name,
      stats: organization.stats,
      subscription: {
        plan: organization.subscription.plan,
        credits: organization.subscription.credits,
        maxConcurrentUsers: organization.subscription.maxConcurrentUsers,
        maxExamsPerMonth: organization.subscription.maxExamsPerMonth,
        startDate: organization.subscription.startDate,
        endDate: organization.subscription.endDate,
      },
      usage: {
        creditsUsed: organization.stats.creditsUsed,
        creditsRemaining: organization.subscription.credits - organization.stats.creditsUsed,
        usagePercentage:
          (organization.stats.creditsUsed / organization.subscription.credits) * 100,
      },
    };
  }
}
