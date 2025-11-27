import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExamTemplateDocument = ExamTemplate & Document;

export enum TargetLevel {
  FRESHER = 'FRESHER',
  JUNIOR = 'JUNIOR',
  MID_LEVEL = 'MID_LEVEL',
  SENIOR = 'SENIOR',
  ARCHITECT = 'ARCHITECT',
}

export enum TemplateCategory {
  CAMPUS_PLACEMENT = 'CAMPUS_PLACEMENT',
  LATERAL_HIRING = 'LATERAL_HIRING',
  SKILL_ASSESSMENT = 'SKILL_ASSESSMENT',
  CERTIFICATION = 'CERTIFICATION',
  PRACTICE = 'PRACTICE',
}

@Schema()
class QuestionDistribution {
  @Prop({ required: true })
  category: string;

  @Prop()
  subcategory: string;

  @Prop({ required: true })
  count: number;

  @Prop()
  difficulty: string;

  @Prop({ required: true })
  marks: number;

  @Prop({ type: Types.ObjectId, ref: 'QuestionPool' })
  poolId: Types.ObjectId;
}

@Schema()
class ProctoringSettings {
  @Prop({ type: Boolean, default: false })
  enabled: boolean;

  @Prop({ type: Number, default: 3 })
  violationWarningLimit: number;

  @Prop({ type: Boolean, default: false })
  webcamRequired: boolean;

  @Prop({ type: Boolean, default: false })
  screenRecording: boolean;

  @Prop({ type: Boolean, default: true })
  tabSwitchDetection: boolean;

  @Prop({ type: Boolean, default: false })
  copyPasteDetection: boolean;

  @Prop({ type: Boolean, default: false })
  rightClickDisabled: boolean;

  @Prop({ type: Boolean, default: false })
  devToolsDetection: boolean;

  @Prop({ type: Boolean, default: false })
  fullscreenRequired: boolean;

  @Prop({ type: Boolean, default: false })
  autoSubmitOnViolation: boolean;

  @Prop({ type: Boolean, default: false })
  faceDetection: boolean;

  @Prop({ type: Boolean, default: false })
  multipleFaceDetection: boolean;

  @Prop({ type: Boolean, default: false })
  mobileDetection: boolean;
}

@Schema()
class Settings {
  @Prop({ type: Boolean, default: true })
  shuffleQuestions: boolean;

  @Prop({ type: Boolean, default: true })
  shuffleOptions: boolean;

  @Prop({ type: Boolean, default: false })
  showResultsImmediately: boolean;

  @Prop({ type: Boolean, default: true })
  allowReview: boolean;

  @Prop({ type: Boolean, default: false })
  showCorrectAnswers: boolean;

  @Prop({ type: Number, default: 1 })
  attemptsAllowed: number;
}

@Schema()
class Stats {
  @Prop({ type: Number, default: 0 })
  usageCount: number;

  @Prop({ type: Number, default: 0 })
  averageScore: number;

  @Prop({ type: Number, default: 0 })
  averageDuration: number;
}

@Schema({ timestamps: true })
export class ExamTemplate {
  @Prop({ required: true, minlength: 3, maxlength: 200 })
  name: string;

  @Prop({ maxlength: 1000 })
  description: string;

  @Prop()
  targetRole: string;

  @Prop({ type: String, enum: Object.values(TargetLevel) })
  targetLevel: TargetLevel;

  @Prop({ type: String, enum: Object.values(TemplateCategory), required: true })
  category: TemplateCategory;

  @Prop({ required: true, min: 1 })
  duration: number;

  @Prop({ type: [QuestionDistribution], default: [] })
  questionDistribution: QuestionDistribution[];

  @Prop({ required: true })
  totalMarks: number;

  @Prop({ required: true })
  passingMarks: number;

  @Prop({ type: ProctoringSettings, default: () => ({}) })
  proctoringSettings: ProctoringSettings;

  @Prop({ type: Settings, default: () => ({}) })
  settings: Settings;

  @Prop({ type: Types.ObjectId, ref: 'Organization', default: null })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isPublic: boolean;

  @Prop({ type: Boolean, default: false })
  isPremium: boolean;

  @Prop({ type: Stats, default: () => ({}) })
  stats: Stats;

  @Prop({ type: [String], default: [] })
  tags: string[];
}

export const ExamTemplateSchema = SchemaFactory.createForClass(ExamTemplate);

// Indexes
ExamTemplateSchema.index({ category: 1, targetLevel: 1, isActive: 1 });
ExamTemplateSchema.index({ organizationId: 1, isActive: 1 });
ExamTemplateSchema.index({ isPublic: 1, isPremium: 1 });
ExamTemplateSchema.index({ createdBy: 1 });
