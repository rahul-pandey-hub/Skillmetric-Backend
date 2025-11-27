import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CertificationDocument = Certification & Document;

export enum CertificationCategory {
  DSA = 'DSA',
  SYSTEM_DESIGN = 'SYSTEM_DESIGN',
  PROGRAMMING = 'PROGRAMMING',
  DATABASE = 'DATABASE',
  DEVOPS = 'DEVOPS',
  FRONTEND = 'FRONTEND',
  BACKEND = 'BACKEND',
  FULLSTACK = 'FULLSTACK',
  SECURITY = 'SECURITY',
  TESTING = 'TESTING',
}

export enum CertificationLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
}

@Schema()
class Criteria {
  @Prop({ type: Number, min: 0 })
  minimumScore: number;

  @Prop({ type: Number, min: 0, max: 100 })
  minimumPercentage: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Exam' }], default: [] })
  requiredExams: Types.ObjectId[];

  @Prop({ type: Number })
  validityPeriod: number; // months
}

@Schema()
class Stats {
  @Prop({ type: Number, default: 0 })
  totalIssued: number;

  @Prop({ type: Number, default: 0 })
  activeCount: number;
}

@Schema({ timestamps: true })
export class Certification {
  @Prop({ required: true, minlength: 3, maxlength: 200 })
  name: string;

  @Prop({ maxlength: 1000 })
  description: string;

  @Prop({ type: String, enum: Object.values(CertificationCategory), required: true })
  category: CertificationCategory;

  @Prop({ type: String, enum: Object.values(CertificationLevel), required: true })
  level: CertificationLevel;

  @Prop({ type: Criteria, required: true })
  criteria: Criteria;

  @Prop()
  badgeImage: string;

  @Prop()
  certificateTemplate: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', default: null })
  organizationId: Types.ObjectId;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isPremium: boolean;

  @Prop({ type: Stats, default: () => ({}) })
  stats: Stats;
}

export const CertificationSchema = SchemaFactory.createForClass(Certification);

// Indexes
CertificationSchema.index({ category: 1, level: 1, isActive: 1 });
CertificationSchema.index({ organizationId: 1, isActive: 1 });
CertificationSchema.index({ isPremium: 1 });
