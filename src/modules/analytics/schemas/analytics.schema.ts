import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AnalyticsDocument = Analytics & Document;

export enum AnalyticsType {
  EXAM_SUMMARY = 'EXAM_SUMMARY',
  QUESTION_ANALYSIS = 'QUESTION_ANALYSIS',
  STUDENT_PERFORMANCE = 'STUDENT_PERFORMANCE',
  VIOLATION_REPORT = 'VIOLATION_REPORT',
}

@Schema()
class ExamSummary {
  @Prop({ type: Number, default: 0 })
  totalCandidates: number;

  @Prop({ type: Number, default: 0 })
  totalEnrolled: number;

  @Prop({ type: Number, default: 0 })
  totalStarted: number;

  @Prop({ type: Number, default: 0 })
  totalSubmitted: number;

  @Prop({ type: Number, default: 0 })
  completionRate: number;

  @Prop({ type: Number, default: 0 })
  averageScore: number;

  @Prop({ type: Number, default: 0 })
  medianScore: number;

  @Prop({ type: Number, default: 0 })
  highestScore: number;

  @Prop({ type: Number, default: 0 })
  lowestScore: number;

  @Prop({ type: Number, default: 0 })
  standardDeviation: number;

  @Prop({ type: Number, default: 0 })
  averageDuration: number;

  @Prop({ type: Number, default: 0 })
  passRate: number;

  @Prop({ type: Object, default: {} })
  scoreDistribution: Record<string, number>;
}

@Schema()
class QuestionAnalysisItem {
  @Prop({ type: Types.ObjectId, ref: 'Question', required: true })
  questionId: Types.ObjectId;

  @Prop()
  questionText: string;

  @Prop()
  category: string;

  @Prop()
  difficulty: string;

  @Prop({ type: Number, default: 0 })
  totalAttempts: number;

  @Prop({ type: Number, default: 0 })
  correctAttempts: number;

  @Prop({ type: Number, default: 0 })
  incorrectAttempts: number;

  @Prop({ type: Number, default: 0 })
  skipped: number;

  @Prop({ type: Number, default: 0 })
  accuracy: number;

  @Prop({ type: Number, default: 0 })
  averageTimeTaken: number;

  @Prop({ type: Number, default: 0, min: 0, max: 1 })
  difficultyIndex: number;

  @Prop({ type: Number, default: 0, min: -1, max: 1 })
  discriminationIndex: number;
}

@Schema()
class CategoryAnalysisItem {
  @Prop({ required: true })
  category: string;

  @Prop({ type: Number, default: 0 })
  totalQuestions: number;

  @Prop({ type: Number, default: 0 })
  averageScore: number;

  @Prop({ type: Number, default: 0 })
  averageAccuracy: number;

  @Prop({ type: Number, default: 0 })
  averageTimeTaken: number;
}

@Schema()
class TopPerformer {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  candidateId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ type: Number, required: true })
  score: number;

  @Prop({ type: Number, required: true })
  rank: number;

  @Prop({ type: Number, required: true })
  percentile: number;
}

@Schema()
class ViolationSummary {
  @Prop({ type: Number, default: 0 })
  totalViolations: number;

  @Prop({ type: Number, default: 0 })
  uniqueViolators: number;

  @Prop({ type: Object, default: {} })
  byType: Record<string, number>;

  @Prop({ type: Object, default: {} })
  bySeverity: Record<string, number>;

  @Prop({ type: Number, default: 0 })
  terminatedExams: number;
}

@Schema()
class ShortlistingData {
  @Prop({ type: Number, default: 0 })
  totalShortlisted: number;

  @Prop({ type: Number, default: 0 })
  shortlistingRate: number;

  @Prop({ type: Object })
  criteriaUsed: any;
}

@Schema({ timestamps: true })
export class Analytics {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(AnalyticsType),
    required: true,
  })
  type: AnalyticsType;

  @Prop({ type: Date, required: true })
  generatedAt: Date;

  @Prop({ type: ExamSummary })
  examSummary?: ExamSummary;

  @Prop({ type: [QuestionAnalysisItem], default: [] })
  questionAnalysis?: QuestionAnalysisItem[];

  @Prop({ type: [CategoryAnalysisItem], default: [] })
  categoryAnalysis?: CategoryAnalysisItem[];

  @Prop({ type: [TopPerformer], default: [] })
  topPerformers?: TopPerformer[];

  @Prop({ type: ViolationSummary })
  violationSummary?: ViolationSummary;

  @Prop({ type: ShortlistingData })
  shortlistingData?: ShortlistingData;
}

export const AnalyticsSchema = SchemaFactory.createForClass(Analytics);

// Indexes
AnalyticsSchema.index({ examId: 1, type: 1 });
AnalyticsSchema.index({ examId: 1, generatedAt: -1 });
AnalyticsSchema.index({ type: 1 });
