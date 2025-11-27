import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BulkOperationsController } from './controllers/bulk-operations.controller';
import { BulkOperationsService } from './services/bulk-operations.service';
import {
  BulkOperation,
  BulkOperationSchema,
} from './schemas/bulk-operation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BulkOperation.name, schema: BulkOperationSchema },
    ]),
  ],
  controllers: [BulkOperationsController],
  providers: [BulkOperationsService],
  exports: [BulkOperationsService, MongooseModule],
})
export class BulkOperationsModule {}
