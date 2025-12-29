import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ViolationType {
  TAB_SWITCH = 'TAB_SWITCH',
  COPY_PASTE = 'COPY_PASTE',
  RIGHT_CLICK = 'RIGHT_CLICK',
  DEV_TOOLS = 'DEV_TOOLS',
  FULLSCREEN_EXIT = 'FULLSCREEN_EXIT',
  NO_FACE = 'NO_FACE',
  MULTIPLE_FACES = 'MULTIPLE_FACES',
  CAMERA_DISABLED = 'CAMERA_DISABLED',
  SUSPICIOUS_BEHAVIOR = 'SUSPICIOUS_BEHAVIOR',
}

export enum ViolationSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Schema({ timestamps: true })
export class Violation extends Document {
  @Prop({ type: Types.ObjectId, ref: 'ExamSession', required: true })
  session: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  student: Types.ObjectId; // For enrolled students

  @Prop({ type: Types.ObjectId, ref: 'ExamInvitation', required: false })
  invitation: Types.ObjectId; // For invitation-based (guest) candidates

  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  exam: Types.ObjectId;

  @Prop({ type: String, enum: ViolationType, required: true })
  type: ViolationType;

  @Prop({ type: String, enum: ViolationSeverity, default: ViolationSeverity.MEDIUM })
  severity: ViolationSeverity;

  @Prop({ required: true })
  detectedAt: Date;

  @Prop({ type: Object })
  details: {
    description: string;
    evidence?: {
      screenshot?: string;
      videoTimestamp?: number;
      additionalData?: any;
    };
  };

  @Prop({ type: Object })
  review: {
    status: 'PENDING' | 'REVIEWED' | 'DISMISSED';
    reviewedBy?: Types.ObjectId;
    reviewedAt?: Date;
    notes?: string;
  };

  @Prop({ default: false })
  warningIssued: boolean;

  @Prop({ default: false })
  autoSubmitTriggered: boolean;
}

export const ViolationSchema = SchemaFactory.createForClass(Violation);

// Indexes
ViolationSchema.index({ session: 1, type: 1 });
ViolationSchema.index({ student: 1, detectedAt: -1 });
ViolationSchema.index({ severity: 1, 'review.status': 1 });
