import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrganizationDocument = Organization & Document;

export enum OrganizationType {
  COMPANY = 'COMPANY',
  UNIVERSITY = 'UNIVERSITY',
  TRAINING_INSTITUTE = 'TRAINING_INSTITUTE',
  INDIVIDUAL = 'INDIVIDUAL',
}

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  TRIAL = 'TRIAL',
  EXPIRED = 'EXPIRED',
}

export enum SubscriptionPlan {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

@Schema()
class ContactInfo {
  @Prop({ required: true })
  email: string;

  @Prop()
  phone: string;

  @Prop()
  website: string;

  @Prop({ type: Object })
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
  };
}

@Schema()
class Subscription {
  @Prop({
    type: String,
    enum: Object.values(SubscriptionPlan),
    default: SubscriptionPlan.FREE
  })
  plan: SubscriptionPlan;

  @Prop({ type: Date })
  startDate: Date;

  @Prop({ type: Date })
  endDate: Date;

  @Prop({ type: Number, default: 1000 })
  credits: number;

  @Prop({ type: Number, default: 100 })
  maxConcurrentUsers: number;

  @Prop({ type: Number, default: 10 })
  maxExamsPerMonth: number;
}

@Schema()
class Features {
  @Prop({ type: [String], default: [] })
  allowedDomains: string[];

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
}

@Schema()
class Branding {
  @Prop()
  logo: string;

  @Prop()
  primaryColor: string;

  @Prop()
  secondaryColor: string;

  @Prop()
  customDomain: string;
}

@Schema()
class Stats {
  @Prop({ type: Number, default: 0 })
  totalUsers: number;

  @Prop({ type: Number, default: 0 })
  totalExams: number;

  @Prop({ type: Number, default: 0 })
  totalAssessments: number;

  @Prop({ type: Number, default: 0 })
  creditsUsed: number;
}

@Schema({ timestamps: true })
export class Organization {
  @Prop({ required: true, minlength: 3, maxlength: 200 })
  name: string;

  @Prop({
    type: String,
    enum: Object.values(OrganizationType),
    required: true
  })
  type: OrganizationType;

  @Prop({
    type: String,
    enum: Object.values(OrganizationStatus),
    default: OrganizationStatus.TRIAL
  })
  status: OrganizationStatus;

  @Prop({ type: ContactInfo, required: true })
  contactInfo: ContactInfo;

  @Prop({ type: Subscription, required: true })
  subscription: Subscription;

  @Prop({ type: Features, default: () => ({}) })
  features: Features;

  @Prop({ type: Branding })
  branding: Branding;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  admins: Types.ObjectId[];

  @Prop({ type: Stats, default: () => ({}) })
  stats: Stats;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);

// Indexes
OrganizationSchema.index({ status: 1 });
OrganizationSchema.index({ type: 1 });
OrganizationSchema.index({ 'subscription.plan': 1 });
OrganizationSchema.index({ 'subscription.endDate': 1 });
