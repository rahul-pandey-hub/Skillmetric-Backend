import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BulkOperationDocument = BulkOperation & Document;

export enum OperationType {
  STUDENT_ENROLLMENT = 'STUDENT_ENROLLMENT',
  EXAM_ASSIGNMENT = 'EXAM_ASSIGNMENT',
  RESULTS_EXPORT = 'RESULTS_EXPORT',
  QUESTION_IMPORT = 'QUESTION_IMPORT',
}

export enum OperationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
}

@Schema()
class Progress {
  @Prop({ type: Number, default: 0 })
  total: number;

  @Prop({ type: Number, default: 0 })
  processed: number;

  @Prop({ type: Number, default: 0 })
  successful: number;

  @Prop({ type: Number, default: 0 })
  failed: number;
}

@Schema()
class ErrorLog {
  @Prop({ required: true })
  row: number;

  @Prop({ required: true })
  field: string;

  @Prop({ required: true })
  error: string;
}

@Schema({ timestamps: true })
export class BulkOperation {
  @Prop({
    type: String,
    enum: Object.values(OperationType),
    required: true,
  })
  type: OperationType;

  @Prop({
    type: String,
    enum: Object.values(OperationStatus),
    default: OperationStatus.PENDING,
  })
  status: OperationStatus;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Exam' })
  examId: Types.ObjectId;

  @Prop({ required: true })
  fileUrl: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  initiatedBy: Types.ObjectId;

  @Prop({ type: Progress, default: () => ({}) })
  progress: Progress;

  @Prop({ type: [ErrorLog], default: [] })
  errors: ErrorLog[];

  @Prop()
  resultFileUrl: string;

  @Prop({ type: Date })
  completedAt: Date;
}

export const BulkOperationSchema = SchemaFactory.createForClass(BulkOperation);

// Indexes
BulkOperationSchema.index({ organizationId: 1, status: 1 });
BulkOperationSchema.index({ examId: 1 });
BulkOperationSchema.index({ initiatedBy: 1 });
BulkOperationSchema.index({ status: 1, createdAt: -1 });
