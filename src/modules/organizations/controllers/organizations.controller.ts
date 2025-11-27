import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { CreateOrganizationCommand } from '../commands/impl/create-organization.command';
import { UpdateOrganizationCommand } from '../commands/impl/update-organization.command';
import {
  Organization,
  OrganizationDocument,
} from '../schemas/organization.schema';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(
    private readonly commandBus: CommandBus,
    @InjectModel(Organization.name)
    private organizationModel: Model<OrganizationDocument>,
  ) {}

  @Post()
  async create(@Body() createOrganizationDto: CreateOrganizationDto) {
    const organization = await this.commandBus.execute(
      new CreateOrganizationCommand(createOrganizationDto),
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Organization created successfully',
      data: organization,
    };
  }

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const query: any = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (page - 1) * limit;

    const [organizations, total] = await Promise.all([
      this.organizationModel
        .find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.organizationModel.countDocuments(query),
    ]);

    return {
      statusCode: HttpStatus.OK,
      data: organizations,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const organization = await this.organizationModel
      .findById(id)
      .populate('admins', 'name email')
      .exec();

    if (!organization) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Organization not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      data: organization,
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    const organization = await this.commandBus.execute(
      new UpdateOrganizationCommand(id, updateOrganizationDto),
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Organization updated successfully',
      data: organization,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const organization = await this.organizationModel.findByIdAndDelete(id);

    if (!organization) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Organization not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Organization deleted successfully',
    };
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    const organization = await this.organizationModel.findById(id);

    if (!organization) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Organization not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      data: organization.stats,
    };
  }

  @Put(':id/admins/:userId')
  async addAdmin(@Param('id') id: string, @Param('userId') userId: string) {
    const organization = await this.organizationModel.findByIdAndUpdate(
      id,
      { $addToSet: { admins: userId } },
      { new: true },
    );

    if (!organization) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Organization not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Admin added successfully',
      data: organization,
    };
  }

  @Delete(':id/admins/:userId')
  async removeAdmin(@Param('id') id: string, @Param('userId') userId: string) {
    const organization = await this.organizationModel.findByIdAndUpdate(
      id,
      { $pull: { admins: userId } },
      { new: true },
    );

    if (!organization) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Organization not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Admin removed successfully',
      data: organization,
    };
  }
}
