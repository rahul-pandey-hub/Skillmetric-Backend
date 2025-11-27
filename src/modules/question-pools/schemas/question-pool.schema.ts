import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuestionPoolDocument = QuestionPool & Document;

@Schema()
class Stats {
  @Prop({ type: Number, default: 0 })
  totalQuestions: number;

  @Prop({ type: Number, default: 0 })
  usageCount: number;
}

@Schema({ timestamps: true })
export class QuestionPool {
  @Prop({ required: true, minlength: 3, maxlength: 200 })
  name: string;

  @Prop({ maxlength: 1000 })
  description: string;

  @Prop({ required: true })
  category: string;

  @Prop()
  subcategory: string;

  @Prop()
  difficulty: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Question' }], default: [] })
  questions: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Organization', default: null })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isPublic: boolean;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Stats, default: () => ({}) })
  stats: Stats;
}

export const QuestionPoolSchema = SchemaFactory.createForClass(QuestionPool);

// Indexes
QuestionPoolSchema.index({ category: 1, difficulty: 1, isActive: 1 });
QuestionPoolSchema.index({ organizationId: 1, isActive: 1 });
QuestionPoolSchema.index({ isPublic: 1 });
QuestionPoolSchema.index({ createdBy: 1 });
