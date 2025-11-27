import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  MULTIPLE_RESPONSE = 'MULTIPLE_RESPONSE',
  TRUE_FALSE = 'TRUE_FALSE',
  CODING = 'CODING',
  SUBJECTIVE = 'SUBJECTIVE',
  SHORT_ANSWER = 'SHORT_ANSWER',
  ESSAY = 'ESSAY',
  FILL_BLANK = 'FILL_BLANK',
}

export enum DifficultyLevel {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  EXPERT = 'EXPERT',
}

export enum QuestionCategory {
  DSA = 'DSA',
  SYSTEM_DESIGN = 'SYSTEM_DESIGN',
  APTITUDE = 'APTITUDE',
  VERBAL = 'VERBAL',
  LOGICAL_REASONING = 'LOGICAL_REASONING',
  PROGRAMMING = 'PROGRAMMING',
  DATABASE = 'DATABASE',
  NETWORKING = 'NETWORKING',
  OS = 'OS',
  DEVOPS = 'DEVOPS',
  FRONTEND = 'FRONTEND',
  BACKEND = 'BACKEND',
  TESTING = 'TESTING',
  SECURITY = 'SECURITY',
  SOFT_SKILLS = 'SOFT_SKILLS',
}

export enum CodingLanguage {
  JAVASCRIPT = 'JAVASCRIPT',
  PYTHON = 'PYTHON',
  JAVA = 'JAVA',
  CPP = 'CPP',
  C = 'C',
  CSHARP = 'CSHARP',
  GO = 'GO',
  RUST = 'RUST',
}

@Schema()
class TestCase {
  @Prop({ required: true })
  input: string;

  @Prop({ required: true })
  expectedOutput: string;

  @Prop({ type: Boolean, default: false })
  isHidden: boolean;

  @Prop({ type: Number, default: 10 })
  points: number;
}

@Schema()
class CodingDetails {
  @Prop({
    type: [String],
    enum: Object.values(CodingLanguage),
    default: [CodingLanguage.JAVASCRIPT],
  })
  language: CodingLanguage[];

  @Prop()
  starterCode?: string;

  @Prop({ type: [TestCase], default: [] })
  testCases: TestCase[];

  @Prop({ type: Number, default: 2000 })
  timeLimit: number;

  @Prop({ type: Number, default: 256 })
  memoryLimit: number;
}

@Schema()
class Analytics {
  @Prop({ type: Number, default: 0 })
  usageCount: number;

  @Prop({ type: Number, default: 0 })
  correctAttempts: number;

  @Prop({ type: Number, default: 0 })
  totalAttempts: number;

  @Prop({ type: Number, default: 0 })
  averageTimeTaken: number;

  @Prop({ type: Number, default: 0, min: 0, max: 1 })
  difficultyIndex: number;
}

@Schema()
class Attachment {
  @Prop({ type: String, enum: ['IMAGE', 'VIDEO', 'DOCUMENT'] })
  type: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  caption?: string;
}

@Schema({ timestamps: true })
export class Question extends Document {
  @Prop({ required: true, minlength: 10, maxlength: 2000 })
  text: string;

  @Prop({ type: String, enum: QuestionType, required: true })
  type: QuestionType;

  @Prop({ type: String, enum: DifficultyLevel, default: DifficultyLevel.MEDIUM })
  difficulty: DifficultyLevel;

  // Enhanced categorization
  @Prop({ type: String, enum: Object.values(QuestionCategory) })
  category?: QuestionCategory;

  @Prop()
  subcategory?: string;

  @Prop()
  topic?: string;

  @Prop({ type: [Object], default: [] })
  options?: Array<{
    id: string;
    text: string;
    isCorrect?: boolean;
  }>;

  @Prop({ type: Object })
  correctAnswer: any;

  // For coding questions
  @Prop({ type: CodingDetails })
  codingDetails?: CodingDetails;

  @Prop({ maxlength: 1000 })
  explanation?: string;

  @Prop({ type: [String], default: [] })
  hints?: string[];

  @Prop({ required: true, default: 1, min: 0.5 })
  marks: number;

  @Prop({ default: 0, min: 0 })
  negativeMarks: number;

  @Prop({ type: Number, default: 120 })
  estimatedTime: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [String], default: [] })
  skillTags: string[];

  // Metadata
  @Prop({ type: Types.ObjectId, ref: 'Organization', default: null })
  organizationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isPublic: boolean;

  @Prop({ type: Boolean, default: false })
  isPremium: boolean;

  // Analytics
  @Prop({ type: Analytics, default: () => ({}) })
  analytics: Analytics;

  @Prop({ type: [Attachment], default: [] })
  attachments?: Attachment[];

  @Prop({ type: Object })
  media?: {
    image?: string;
    video?: string;
    audio?: string;
  };

  @Prop({ type: Date })
  lastUsedAt?: Date;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);

// Indexes
QuestionSchema.index({ category: 1, difficulty: 1, isActive: 1 });
QuestionSchema.index({ subcategory: 1, difficulty: 1 });
QuestionSchema.index({ type: 1, isActive: 1 });
QuestionSchema.index({ tags: 1 });
QuestionSchema.index({ organizationId: 1, isActive: 1 });
QuestionSchema.index({ 'analytics.difficultyIndex': 1 });
QuestionSchema.index({ createdBy: 1, isActive: 1 });
