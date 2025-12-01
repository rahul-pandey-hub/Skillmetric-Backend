import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExamTemplateDocument = ExamTemplate & Document;

export enum TemplateCategory {
  TECHNICAL = 'TECHNICAL',
  APTITUDE = 'APTITUDE',
  LANGUAGE = 'LANGUAGE',
  CUSTOM = 'CUSTOM',
}

@Schema()
class TemplateSettings {
  @Prop({ type: Number, default: 60 })
  defaultDuration: number;

  @Prop({ type: Number, default: 40 })
  passingPercentage: number;

  @Prop({ type: Boolean, default: true })
  randomizeQuestions: boolean;

  @Prop({ type: Boolean, default: false })
  showResultsImmediately: boolean;

  @Prop({ type: Boolean, default: true })
  allowReview: boolean;
}

@Schema({ timestamps: true })
export class ExamTemplate {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({
    type: String,
    enum: Object.values(TemplateCategory),
    required: true,
  })
  category: TemplateCategory;

  @Prop({ type: TemplateSettings, default: () => ({}) })
  settings: TemplateSettings;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  usageCount: number;
}

export const ExamTemplateSchema = SchemaFactory.createForClass(ExamTemplate);

// Indexes
ExamTemplateSchema.index({ category: 1, isActive: 1 });
ExamTemplateSchema.index({ name: 'text', description: 'text' });
