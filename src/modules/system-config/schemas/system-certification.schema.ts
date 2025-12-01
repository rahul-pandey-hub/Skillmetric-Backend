import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SystemCertificationDocument = SystemCertification & Document;

export enum CertificationType {
  COMPLETION = 'COMPLETION',
  ACHIEVEMENT = 'ACHIEVEMENT',
  SKILL_BASED = 'SKILL_BASED',
  CUSTOM = 'CUSTOM',
}

export enum CertificationValidity {
  LIFETIME = 'LIFETIME',
  ONE_YEAR = 'ONE_YEAR',
  TWO_YEARS = 'TWO_YEARS',
  THREE_YEARS = 'THREE_YEARS',
}

@Schema()
class CertificationCriteria {
  @Prop({ type: Number, default: 70 })
  minimumScore: number;

  @Prop({ type: Number, default: 0 })
  minimumAssessments: number;

  @Prop({ type: [String], default: [] })
  requiredSkills: string[];

  @Prop({ type: Boolean, default: false })
  requireAllSkills: boolean;
}

@Schema()
class CertificateDesign {
  @Prop()
  templateUrl: string;

  @Prop()
  badgeUrl: string;

  @Prop({ type: String, default: '#1976d2' })
  primaryColor: string;

  @Prop({ type: String, default: '#424242' })
  secondaryColor: string;
}

@Schema({ timestamps: true })
export class SystemCertification {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({
    type: String,
    enum: Object.values(CertificationType),
    required: true,
  })
  type: CertificationType;

  @Prop({
    type: String,
    enum: Object.values(CertificationValidity),
    default: CertificationValidity.LIFETIME,
  })
  validity: CertificationValidity;

  @Prop({ type: CertificationCriteria, required: true })
  criteria: CertificationCriteria;

  @Prop({ type: CertificateDesign, default: () => ({}) })
  design: CertificateDesign;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  issuedCount: number;

  @Prop({ type: [String], default: [] })
  categories: string[];
}

export const SystemCertificationSchema =
  SchemaFactory.createForClass(SystemCertification);

// Indexes
SystemCertificationSchema.index({ type: 1, isActive: 1 });
SystemCertificationSchema.index({ name: 'text', description: 'text' });
SystemCertificationSchema.index({ categories: 1 });
