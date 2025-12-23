import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  AUTO_SUBMITTED = 'AUTO_SUBMITTED',
  ABANDONED = 'ABANDONED',
}

@Schema({ timestamps: true })
export class ExamSession extends Document {
  @Prop({ sparse: true })
  sessionCode?: string;

  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  studentId: Types.ObjectId;

  @Prop({ type: String, enum: SessionStatus, default: SessionStatus.IN_PROGRESS })
  status: string;

  @Prop({ default: 0 })
  warningCount: number;

  @Prop({ type: [Object], default: [] })
  violations: Array<{
    type: string;
    details: any;
    timestamp: Date;
    severity?: string;
  }>;

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: true })
  endTime: Date;

  @Prop()
  submittedAt?: Date;

  @Prop({ type: [String], default: [] })
  questionOrder: string[];

  @Prop({ type: [Object], default: [] })
  answers: Array<{
    questionId: string;
    answer?: any;
    selectedOption?: string;
    selectedOptions?: string[];
    savedAt?: Date;
  }>;

  @Prop({ type: Number })
  score?: number;

  @Prop()
  autoSubmitReason?: string;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;
}

export const ExamSessionSchema = SchemaFactory.createForClass(ExamSession);

// Indexes
ExamSessionSchema.index({ sessionCode: 1 });
ExamSessionSchema.index({ examId: 1, studentId: 1 });
ExamSessionSchema.index({ status: 1, startTime: -1 });
ExamSessionSchema.index({ warningCount: 1 });
