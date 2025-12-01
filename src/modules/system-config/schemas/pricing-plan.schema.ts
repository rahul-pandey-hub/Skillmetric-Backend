import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PricingPlanDocument = PricingPlan & Document;

export enum PlanTier {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

@Schema()
class PlanFeatures {
  @Prop({ type: Number, required: true })
  credits: number;

  @Prop({ type: Number, required: true })
  maxConcurrentUsers: number;

  @Prop({ type: Number, required: true })
  maxExamsPerMonth: number;

  @Prop({ type: Number, default: 0 })
  maxStorageGB: number;

  @Prop({ type: Boolean, default: false })
  brandingEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  customEmailTemplates: boolean;

  @Prop({ type: Boolean, default: false })
  advancedProctoring: boolean;

  @Prop({ type: Boolean, default: false })
  apiAccess: boolean;

  @Prop({ type: Boolean, default: false })
  bulkOperations: boolean;

  @Prop({ type: Boolean, default: false })
  analyticsExport: boolean;

  @Prop({ type: Boolean, default: false })
  prioritySupport: boolean;

  @Prop({ type: Boolean, default: false })
  dedicatedAccountManager: boolean;

  @Prop({ type: Boolean, default: false })
  customIntegrations: boolean;

  @Prop({ type: Boolean, default: false })
  whiteLabeling: boolean;
}

@Schema()
class PlanPricing {
  @Prop({ type: Number, required: true })
  monthly: number;

  @Prop({ type: Number, required: true })
  quarterly: number;

  @Prop({ type: Number, required: true })
  yearly: number;

  @Prop({ type: String, default: 'USD' })
  currency: string;
}

@Schema({ timestamps: true })
export class PricingPlan {
  @Prop({
    type: String,
    enum: Object.values(PlanTier),
    required: true,
    unique: true,
  })
  tier: PlanTier;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: PlanPricing, required: true })
  pricing: PlanPricing;

  @Prop({ type: PlanFeatures, required: true })
  features: PlanFeatures;

  @Prop({ type: [String], default: [] })
  highlights: string[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: true })
  isPublic: boolean;

  @Prop({ type: Number, default: 0 })
  subscriberCount: number;
}

export const PricingPlanSchema = SchemaFactory.createForClass(PricingPlan);

// Indexes
PricingPlanSchema.index({ tier: 1 });
PricingPlanSchema.index({ isActive: 1, isPublic: 1 });
