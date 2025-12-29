import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ResultStatus {
  EVALUATING = 'EVALUATING',
  PENDING = 'PENDING',
  EVALUATED = 'EVALUATED',
  GRADED = 'GRADED',
  PUBLISHED = 'PUBLISHED',
  WITHHELD = 'WITHHELD',
}

@Schema()
class AnswerDetail {
  @Prop({ type: Types.ObjectId, ref: 'Question', required: true })
  questionId: Types.ObjectId;

  @Prop()
  questionText?: string;

  @Prop()
  questionType?: string;

  @Prop()
  category?: string;

  @Prop()
  difficulty?: string;

  @Prop()
  selectedOption?: string;

  @Prop({ type: Object })
  correctAnswer?: any;

  @Prop()
  textAnswer?: string;

  @Prop()
  codeAnswer?: string;

  @Prop({ type: Boolean })
  isCorrect: boolean;

  @Prop({ required: true })
  marksAwarded: number;

  @Prop({ required: true })
  maxMarks: number;

  @Prop()
  timeTaken?: number;

  @Prop({ type: Boolean, default: false })
  isFlagged: boolean;

  @Prop({ type: Boolean, default: false })
  wasReviewed: boolean;

  @Prop({ type: Boolean, default: false })
  requiresManualGrading?: boolean;

  @Prop()
  feedback?: string;
}

@Schema()
class Scoring {
  @Prop({ required: true })
  totalScore: number;

  @Prop({ required: true })
  totalMarks: number;

  @Prop({ required: true })
  percentage: number;

  @Prop()
  percentileRank?: number;

  @Prop()
  grade?: string;

  @Prop({ type: Boolean, required: true })
  passed: boolean;

  @Prop({ default: 0 })
  correctAnswers: number;

  @Prop({ default: 0 })
  incorrectAnswers: number;

  @Prop({ default: 0 })
  unanswered: number;

  @Prop({ default: 0 })
  negativeMarks: number;
}

@Schema()
class CategoryScore {
  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  totalQuestions: number;

  @Prop({ required: true })
  attempted: number;

  @Prop({ required: true })
  correct: number;

  @Prop({ required: true })
  incorrect: number;

  @Prop({ required: true })
  score: number;

  @Prop({ required: true })
  maxScore: number;

  @Prop({ required: true })
  accuracy: number;
}

@Schema()
class TimeAnalysis {
  @Prop({ required: true })
  totalTimeTaken: number;

  @Prop({ required: true })
  averageTimePerQuestion: number;

  @Prop()
  fastestQuestion?: number;

  @Prop()
  slowestQuestion?: number;
}

@Schema()
class Ranking {
  @Prop()
  rank?: number;

  @Prop()
  outOf?: number;

  @Prop()
  percentile?: number;

  @Prop({ type: Boolean, default: false })
  topScorer: boolean;
}

@Schema()
class Flags {
  @Prop({ type: Boolean, default: false })
  suspiciousActivity: boolean;

  @Prop({ type: Boolean, default: false })
  manualReviewRequired: boolean;

  @Prop({ type: Boolean, default: false })
  violationsDetected: boolean;

  @Prop({ type: Boolean, default: false })
  incompleteSubmission: boolean;
}

@Schema()
class Certificate {
  @Prop({ type: Boolean, default: false })
  generated: boolean;

  @Prop()
  certificateId?: string;

  @Prop()
  certificateUrl?: string;

  @Prop({ type: Date })
  generatedAt?: Date;
}

@Schema({ timestamps: true })
export class Result extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  exam: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  student?: Types.ObjectId; // Optional: Required for enrollment, null for invitation

  @Prop({ type: Types.ObjectId, ref: 'ExamSession', required: true })
  session: Types.ObjectId;

  // New fields for invitation-based access
  @Prop({ type: Types.ObjectId, ref: 'ExamInvitation' })
  invitationId?: Types.ObjectId; // Reference to ExamInvitation for recruitment exams

  @Prop({ type: Object })
  guestCandidateInfo?: {
    email: string;
    name: string;
    phone?: string;
  }; // Denormalized guest candidate data for invitation-based access

  @Prop({ type: Boolean, default: true })
  visibleToCandidate: boolean; // Control whether candidate can see this result

  @Prop({ type: Boolean, default: false })
  isRecruitmentExam: boolean; // Flag to indicate recruitment exam result

  @Prop({ type: Number, default: 1 })
  attemptNumber: number;

  @Prop({ type: String, enum: ResultStatus, default: ResultStatus.PENDING })
  status: ResultStatus;

  // Complete answer details
  @Prop({ type: [AnswerDetail], default: [] })
  answers: AnswerDetail[];

  // Scoring
  @Prop({ type: Scoring, required: true })
  scoring: Scoring;

  // Category-wise performance
  @Prop({ type: [CategoryScore], default: [] })
  categoryWiseScore: CategoryScore[];

  // Time analysis
  @Prop({ type: TimeAnalysis })
  timeAnalysis?: TimeAnalysis;

  // Ranking & comparison
  @Prop({ type: Ranking, default: () => ({}) })
  ranking: Ranking;

  // Shortlisting decision (legacy field)
  @Prop({ type: Boolean, default: false })
  shortlisted: boolean;

  @Prop()
  shortlistingReason?: string;

  // New detailed shortlisting decision (for recruitment exams)
  @Prop({ type: Object })
  shortlistingDecision?: {
    isShortlisted: boolean;
    shortlistedAt?: Date;
    shortlistedBy?: Types.ObjectId;
    rejectedAt?: Date;
    rejectedBy?: Types.ObjectId;
    comments?: string;
  };

  // Flags
  @Prop({ type: Flags, default: () => ({}) })
  flags: Flags;

  // Certificate
  @Prop({ type: Certificate, default: () => ({}) })
  certificate: Certificate;

  @Prop({ type: Object })
  analysis?: {
    timeSpent: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    accuracy: number;
  };

  @Prop({ type: Object })
  proctoringReport?: {
    totalViolations: number;
    violationBreakdown: any;
    autoSubmitted: boolean;
    warningsIssued: number;
  };

  @Prop({ type: Types.ObjectId, ref: 'User' })
  gradedBy?: Types.ObjectId;

  @Prop()
  gradedAt?: Date;

  @Prop()
  publishedAt?: Date;

  @Prop({ type: Date })
  submittedAt?: Date;

  @Prop({ type: Date })
  evaluatedAt?: Date;

  @Prop()
  feedback?: string;

  // Late submission tracking
  @Prop({ type: Object })
  lateSubmission?: {
    isLate: boolean;
    lateByMinutes: number;
    penaltyApplied: number;
    originalScore: number;
  };

  // Email tracking
  @Prop({
    type: {
      enrollmentSent: { type: Boolean, default: false },
      enrollmentSentAt: Date,
      enrollmentError: String,
      resultSent: { type: Boolean, default: false },
      resultSentAt: Date,
      resultError: String,
      remindersSent: { type: Number, default: 0 },
      lastReminderAt: Date,
    },
    default: () => ({
      enrollmentSent: false,
      resultSent: false,
      remindersSent: 0,
    }),
  })
  emailTracking?: {
    enrollmentSent: boolean;
    enrollmentSentAt?: Date;
    enrollmentError?: string;
    resultSent: boolean;
    resultSentAt?: Date;
    resultError?: string;
    remindersSent: number;
    lastReminderAt?: Date;
  };

  // Legacy field for backward compatibility
  @Prop()
  rank?: number;

  @Prop()
  percentile?: number;

  @Prop({ type: [Object], default: [] })
  questionResults?: Array<{
    questionId: Types.ObjectId;
    answer: any;
    correctAnswer: any;
    isCorrect: boolean;
    marksObtained: number;
    totalMarks: number;
    requiresManualGrading?: boolean;
    feedback?: string;
  }>;

  @Prop({ type: Object })
  score?: {
    obtained: number;
    total: number;
    percentage: number;
    grade?: string;
    passed: boolean;
  };
}

export const ResultSchema = SchemaFactory.createForClass(Result);

// Indexes
// Updated indexes to support both enrollment and invitation-based results
// Unique constraint for enrollment-based results (where student exists)
ResultSchema.index(
  { exam: 1, student: 1, attemptNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { student: { $exists: true, $ne: null } },
  }
);

// Unique constraint for invitation-based results (where invitationId exists)
ResultSchema.index(
  { exam: 1, invitationId: 1, attemptNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { invitationId: { $exists: true, $ne: null } },
  }
);

// Existing indexes
ResultSchema.index({ exam: 1, 'scoring.totalScore': -1 });
ResultSchema.index({ exam: 1, 'scoring.percentileRank': -1 });
ResultSchema.index({ student: 1, status: 1 });
ResultSchema.index({ exam: 1, shortlisted: 1 });
ResultSchema.index({ exam: 1, 'ranking.rank': 1 });
ResultSchema.index({ status: 1, exam: 1 });

// New indexes for invitation-based results
ResultSchema.index({ invitationId: 1 });
ResultSchema.index({ 'guestCandidateInfo.email': 1 });
ResultSchema.index({ isRecruitmentExam: 1, exam: 1 });
ResultSchema.index({ exam: 1, 'shortlistingDecision.isShortlisted': 1 });
