import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ExamStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum ExamType {
  ASSESSMENT = 'ASSESSMENT',
  PRACTICE = 'PRACTICE',
  CERTIFICATION = 'CERTIFICATION',
  MOCK_TEST = 'MOCK_TEST',
}

export enum GradingScheme {
  PERCENTAGE = 'PERCENTAGE',
  LETTER_GRADE = 'LETTER_GRADE',
  PASS_FAIL = 'PASS_FAIL',
  PERCENTILE = 'PERCENTILE',
}

@Schema()
class QuestionPoolConfig {
  @Prop({ type: Types.ObjectId, ref: 'QuestionPool', required: true })
  poolId: Types.ObjectId;

  @Prop({ required: true })
  questionsToSelect: number;

  @Prop()
  category?: string;

  @Prop()
  difficulty?: string;
}

@Schema()
class AccessControl {
  @Prop()
  accessCode?: string;

  @Prop({ type: [String], default: [] })
  allowedDomains: string[];

  @Prop({ type: [String], default: [] })
  allowedEmails: string[];

  @Prop({ type: Boolean, default: false })
  requiresApproval: boolean;

  @Prop({ type: Boolean, default: false })
  isPublic: boolean;
}

@Schema()
class Schedule {
  @Prop({ type: Date })
  startDate: Date;

  @Prop({ type: Date })
  endDate: Date;

  @Prop({ type: Boolean, default: false })
  lateSubmissionAllowed: boolean;

  @Prop({ type: Number, default: 0 })
  lateSubmissionPenalty: number;
}

@Schema()
class Grading {
  @Prop({ required: true })
  totalMarks: number;

  @Prop({ required: true })
  passingMarks: number;

  @Prop()
  passingPercentage?: number;

  @Prop({ type: Boolean, default: false })
  negativeMarking: boolean;

  @Prop()
  negativeMarkValue?: number;
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

  @Prop({ type: Number, default: 1 })
  attemptsAllowed: number;
}

@Schema()
class ResultsSettings {
  @Prop({ type: Boolean, default: true })
  showScore: boolean;

  @Prop({ type: Boolean, default: true })
  showPercentile: boolean;

  @Prop({ type: Boolean, default: false })
  showCorrectAnswers: boolean;

  @Prop({ type: Boolean, default: false })
  showDetailedAnalysis: boolean;

  @Prop({ type: Date })
  publishDate?: Date;

  @Prop({ type: Boolean, default: false })
  generateCertificate: boolean;

  @Prop()
  certificateTemplate?: string;
}

@Schema()
class SectionCutoff {
  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  minimumScore: number;
}

@Schema()
class ShortlistingCriteria {
  @Prop({ type: Boolean, default: false })
  enabled: boolean;

  @Prop()
  minimumScore?: number;

  @Prop()
  minimumPercentage?: number;

  @Prop()
  percentileThreshold?: number;

  @Prop()
  autoAdvanceTopN?: number;

  @Prop()
  autoAdvanceTopPercent?: number;

  @Prop({ type: [SectionCutoff], default: [] })
  sectionWiseCutoff: SectionCutoff[];
}

@Schema()
class Stats {
  @Prop({ type: Number, default: 0 })
  totalEnrolled: number;

  @Prop({ type: Number, default: 0 })
  totalStarted: number;

  @Prop({ type: Number, default: 0 })
  totalSubmitted: number;

  @Prop({ type: Number, default: 0 })
  totalInProgress: number;

  @Prop({ type: Number, default: 0 })
  averageScore: number;

  @Prop({ type: Number, default: 0 })
  medianScore: number;

  @Prop({ type: Number, default: 0 })
  highestScore: number;

  @Prop({ type: Number, default: 0 })
  lowestScore: number;

  @Prop({ type: Number, default: 0 })
  averageDuration: number;

  @Prop({ type: Number, default: 0 })
  completionRate: number;

  @Prop({ type: Number, default: 0 })
  passRate: number;
}

@Schema({ timestamps: true })
export class Exam extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ExamTemplate' })
  templateId?: Types.ObjectId;

  @Prop({ required: true })
  duration: number;

  @Prop({ type: String, enum: ExamStatus, default: ExamStatus.DRAFT })
  status: ExamStatus;

  @Prop({ type: String, enum: Object.values(ExamType), default: ExamType.ASSESSMENT })
  type: ExamType;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  // Question configuration
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Question' }], default: [] })
  questions: Types.ObjectId[];

  @Prop({ type: [QuestionPoolConfig], default: [] })
  questionPools: QuestionPoolConfig[];

  @Prop({ type: Number, default: 0 })
  totalQuestions: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  enrolledStudents: Types.ObjectId[];

  @Prop({ type: AccessControl, default: () => ({}) })
  accessControl: AccessControl;

  @Prop({ type: Schedule })
  schedule?: Schedule;

  @Prop({ type: Grading })
  grading: Grading;

  @Prop({ type: ProctoringSettings, default: () => ({}) })
  proctoringSettings: ProctoringSettings;

  @Prop({ type: Settings, default: () => ({}) })
  settings: Settings;

  @Prop({ type: ResultsSettings, default: () => ({}) })
  resultsSettings: ResultsSettings;

  @Prop({ type: ShortlistingCriteria, default: () => ({}) })
  shortlistingCriteria: ShortlistingCriteria;

  @Prop({ type: Stats, default: () => ({}) })
  stats: Stats;

  @Prop({ type: Date })
  publishedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;
}

export const ExamSchema = SchemaFactory.createForClass(Exam);

// Indexes
ExamSchema.index({ code: 1 });
ExamSchema.index({ organizationId: 1, status: 1 });
ExamSchema.index({ status: 1 });
ExamSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });
ExamSchema.index({ createdBy: 1 });
ExamSchema.index({ enrolledStudents: 1 });
