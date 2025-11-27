import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BulkOperation,
  BulkOperationDocument,
  OperationType,
  OperationStatus,
} from '../schemas/bulk-operation.schema';

@Injectable()
export class BulkOperationsService {
  constructor(
    @InjectModel(BulkOperation.name)
    private bulkOperationModel: Model<BulkOperationDocument>,
  ) {}

  async createOperation(data: {
    type: OperationType;
    organizationId: string;
    examId?: string;
    fileUrl: string;
    initiatedBy: string;
    total: number;
  }): Promise<BulkOperationDocument> {
    const operation = new this.bulkOperationModel({
      type: data.type,
      organizationId: data.organizationId,
      examId: data.examId,
      fileUrl: data.fileUrl,
      initiatedBy: data.initiatedBy,
      status: OperationStatus.PENDING,
      progress: {
        total: data.total,
        processed: 0,
        successful: 0,
        failed: 0,
      },
    });

    return await operation.save();
  }

  async updateProgress(
    operationId: string,
    update: {
      processed?: number;
      successful?: number;
      failed?: number;
      status?: OperationStatus;
    },
  ): Promise<BulkOperationDocument> {
    const updateFields: any = {};

    if (update.processed !== undefined) {
      updateFields['progress.processed'] = update.processed;
    }
    if (update.successful !== undefined) {
      updateFields['progress.successful'] = update.successful;
    }
    if (update.failed !== undefined) {
      updateFields['progress.failed'] = update.failed;
    }
    if (update.status) {
      updateFields.status = update.status;
    }

    const operation = await this.bulkOperationModel.findByIdAndUpdate(
      operationId,
      { $set: updateFields },
      { new: true },
    );

    if (!operation) {
      throw new NotFoundException(`Operation with ID ${operationId} not found`);
    }

    return operation;
  }

  async addError(
    operationId: string,
    error: { row: number; field: string; error: string },
  ): Promise<void> {
    await this.bulkOperationModel.findByIdAndUpdate(operationId, {
      $push: { errors: error },
    });
  }

  async completeOperation(
    operationId: string,
    resultFileUrl?: string,
  ): Promise<BulkOperationDocument> {
    const operation = await this.bulkOperationModel.findById(operationId);

    if (!operation) {
      throw new NotFoundException(`Operation with ID ${operationId} not found`);
    }

    const status =
      operation.progress.failed > 0
        ? OperationStatus.PARTIALLY_COMPLETED
        : OperationStatus.COMPLETED;

    const updated = await this.bulkOperationModel.findByIdAndUpdate(
      operationId,
      {
        $set: {
          status,
          completedAt: new Date(),
          resultFileUrl,
        },
      },
      { new: true },
    );

    return updated;
  }

  async getOperation(operationId: string): Promise<BulkOperationDocument> {
    const operation = await this.bulkOperationModel
      .findById(operationId)
      .populate('initiatedBy', 'name email')
      .populate('examId', 'title code')
      .exec();

    if (!operation) {
      throw new NotFoundException(`Operation with ID ${operationId} not found`);
    }

    return operation;
  }

  async getOperationsByOrganization(
    organizationId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ operations: BulkOperationDocument[]; total: number }> {
    const skip = (page - 1) * limit;

    const [operations, total] = await Promise.all([
      this.bulkOperationModel
        .find({ organizationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('initiatedBy', 'name email')
        .populate('examId', 'title code')
        .exec(),
      this.bulkOperationModel.countDocuments({ organizationId }),
    ]);

    return { operations, total };
  }
}
