import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { BulkOperationsService } from '../services/bulk-operations.service';

@Controller('bulk-operations')
@UseGuards(JwtAuthGuard)
export class BulkOperationsController {
  constructor(
    private readonly bulkOperationsService: BulkOperationsService,
  ) {}

  @Get(':id')
  async getOperation(@Param('id') id: string) {
    const operation = await this.bulkOperationsService.getOperation(id);

    return {
      statusCode: HttpStatus.OK,
      data: operation,
    };
  }

  @Get('organization/:organizationId')
  async getOperationsByOrganization(
    @Param('organizationId') organizationId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const { operations, total } =
      await this.bulkOperationsService.getOperationsByOrganization(
        organizationId,
        page,
        limit,
      );

    return {
      statusCode: HttpStatus.OK,
      data: operations,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
