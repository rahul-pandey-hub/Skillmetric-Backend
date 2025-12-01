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
import { UserManagementService } from '../services/user-management.service';
import { CreateUserDto, BulkCreateUsersDto, UpdateUserDto } from '../dto/create-user.dto';
import { UserFiltersDto } from '../dto/user-filters.dto';

@ApiTags('Organization Admin - User Management')
@ApiBearerAuth()
@Controller('org-admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORG_ADMIN)
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async createUser(@Body() dto: CreateUserDto, @Request() req) {
    const organizationId = req.user.organizationId;
    return this.userManagementService.createUser(dto, organizationId);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk create users from CSV' })
  @ApiResponse({ status: 201, description: 'Bulk creation completed' })
  async bulkCreateUsers(@Body() dto: BulkCreateUsersDto, @Request() req) {
    const organizationId = req.user.organizationId;
    return this.userManagementService.bulkCreateUsers(dto.users, organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users with filters' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getAllUsers(@Query() filters: UserFiltersDto, @Request() req) {
    const organizationId = req.user.organizationId;
    return this.userManagementService.getAllUsers(filters, organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string, @Request() req) {
    const organizationId = req.user.organizationId;
    return this.userManagementService.getUserById(id, organizationId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req,
  ) {
    const organizationId = req.user.organizationId;
    return this.userManagementService.updateUser(id, dto, organizationId);
  }

  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Toggle user active status' })
  @ApiResponse({ status: 200, description: 'User status toggled successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async toggleUserStatus(@Param('id') id: string, @Request() req) {
    const organizationId = req.user.organizationId;
    return this.userManagementService.toggleUserStatus(id, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id') id: string, @Request() req) {
    const organizationId = req.user.organizationId;
    return this.userManagementService.deleteUser(id, organizationId);
  }
}
