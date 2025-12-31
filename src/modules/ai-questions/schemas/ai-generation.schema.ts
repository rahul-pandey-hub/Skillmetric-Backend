import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { QuestionType, DifficultyLevel, QuestionCategory } from '../../questions/schemas/question.schema';

export enum GenerationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

export enum AIProvider {
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  AZURE_OPENAI = 'AZURE_OPENAI',
}

@Schema()
class GenerationError {
  @Prop({ required: true })
  questionIndex: number;

  @Prop({ required: true })
  error: string;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;
}

@Schema()
class AIMetadata {
  @Prop({ required: true })
  model: string;

  @Prop({ required: true })
  promptVersion: string;

  @Prop()
  confidence?: number;

  @Prop()
  generationTime?: number;

  @Prop()
  tokensUsed?: number;

  @Prop()
  batchIndex?: number;

  @Prop()
  regenerated?: boolean;

  @Prop()
  originalQuestionId?: string;
}

@Schema()
class GeneratedQuestionData {
  @Prop({ required: true })
  tempId: string;

  @Prop({ required: true })
  text: string;

  @Prop({ type: String, enum: QuestionType, required: true })
  type: QuestionType;

  @Prop({ type: String, enum: DifficultyLevel, required: true })
  difficulty: DifficultyLevel;

  @Prop({ type: String, enum: Object.values(QuestionCategory) })
  category: QuestionCategory;

  @Prop()
  subcategory: string;

  @Prop()
  topic?: string;

  @Prop({ type: [Object], default: [] })
  options?: Array<{
    id?: string;
    text: string;
    isCorrect?: boolean;
  }>;

  @Prop({ type: Object })
  correctAnswer: any;

  @Prop()
  explanation?: string;

  @Prop({ type: [String], default: [] })
  hints?: string[];

  @Prop({ required: true })
  marks: number;

  @Prop({ default: 0 })
  negativeMarks: number;

  @Prop({ default: 120 })
  estimatedTime: number;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ type: Object })
  codingDetails?: any;

  @Prop({ type: AIMetadata, required: true })
  aiMetadata: AIMetadata;

  @Prop({ type: Date, default: Date.now })
  generatedAt: Date;
}

@Schema({ timestamps: true })
export class AIGeneration extends Document {
  // Request Parameters
  @Prop({ required: true, type: String, enum: Object.values(QuestionCategory) })
  mainTopic: QuestionCategory;

  @Prop({ required: true })
  subTopic: string;

  @Prop({ required: true, type: String, enum: DifficultyLevel })
  difficulty: DifficultyLevel;

  @Prop({ required: true, min: 1, max: 50 })
  numberOfQuestions: number;

  @Prop({ required: true, type: [String], enum: Object.values(QuestionType) })
  questionTypes: QuestionType[];

  @Prop({ required: true, min: 0.5, max: 10 })
  marksPerQuestion: number;

  @Prop({ maxlength: 500 })
  additionalInstructions?: string;

  @Prop({ default: false })
  includeNegativeMarking: boolean;

  @Prop({ min: 0 })
  negativeMarks?: number;

  @Prop({ default: true })
  includeExplanations: boolean;

  @Prop({ default: true })
  includeHints: boolean;

  @Prop({ default: 120, min: 30, max: 1800 })
  estimatedTime: number;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  // AI Provider Information
  @Prop({ required: true, type: String, enum: AIProvider, default: AIProvider.GEMINI })
  aiProvider: AIProvider;

  @Prop({ required: true })
  aiModel: string;

  @Prop({ required: true })
  promptVersion: string;

  // Generation Results
  @Prop({ required: true, type: String, enum: GenerationStatus, default: GenerationStatus.PENDING })
  status: GenerationStatus;

  @Prop({ type: [GeneratedQuestionData], default: [] })
  generatedQuestions: GeneratedQuestionData[];

  @Prop({ default: 0 })
  requestedCount: number;

  @Prop({ default: 0 })
  generatedCount: number;

  @Prop({ default: 0 })
  failedCount: number;

  @Prop({ type: [GenerationError], default: [] })
  generationErrors?: GenerationError[];

  // Performance Metrics
  @Prop()
  totalGenerationTime?: number;

  @Prop({ default: 0 })
  apiCost?: number;

  @Prop()
  tokensUsed?: number;

  // Saved Questions
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Question' }], default: [] })
  savedQuestions: Types.ObjectId[];

  @Prop({ type: Date })
  savedAt?: Date;

  @Prop()
  savedBy?: Types.ObjectId;

  // Audit Fields
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Organization' })
  organizationId: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  // Retry Logic
  @Prop({ default: 0 })
  retryCount: number;

  @Prop({ type: Date })
  lastRetryAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AIGeneration' })
  parentGenerationId?: Types.ObjectId;

  // Additional Metadata
  @Prop({ type: Object })
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
  };
}

export const AIGenerationSchema = SchemaFactory.createForClass(AIGeneration);

// Indexes for efficient queries
AIGenerationSchema.index({ organizationId: 1, createdBy: 1, createdAt: -1 });
AIGenerationSchema.index({ status: 1, createdAt: -1 });
AIGenerationSchema.index({ mainTopic: 1, subTopic: 1, difficulty: 1 });
AIGenerationSchema.index({ aiProvider: 1, aiModel: 1 });
AIGenerationSchema.index({ createdAt: -1 });
AIGenerationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
