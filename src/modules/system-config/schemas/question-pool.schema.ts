import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuestionPoolDocument = QuestionPool & Document;

export enum PoolVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  ORGANIZATION = 'ORGANIZATION',
}

export enum DifficultyLevel {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

@Schema({ timestamps: true })
export class QuestionPool {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({
    type: String,
    enum: Object.values(PoolVisibility),
    default: PoolVisibility.PRIVATE,
  })
  visibility: PoolVisibility;

  @Prop({ type: [String], required: true })
  categories: string[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({
    type: String,
    enum: Object.values(DifficultyLevel),
    default: DifficultyLevel.MEDIUM,
  })
  difficulty: DifficultyLevel;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Question' }], default: [] })
  questions: Types.ObjectId[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  usageCount: number;
}

export const QuestionPoolSchema = SchemaFactory.createForClass(QuestionPool);

// Indexes
QuestionPoolSchema.index({ visibility: 1, isActive: 1 });
QuestionPoolSchema.index({ categories: 1 });
QuestionPoolSchema.index({ name: 'text', description: 'text' });
