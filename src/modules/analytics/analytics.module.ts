import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Analytics, AnalyticsSchema } from './schemas/analytics.schema';
import { ExamAnalyticsService } from './services/exam-analytics.service';
import { ExamAnalyticsController } from './controllers/exam-analytics.controller';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import { Result, ResultSchema } from '../results/schemas/result.schema';
import { ExamSession, ExamSessionSchema } from '../proctoring/schemas/exam-session.schema';
import { Question, QuestionSchema } from '../questions/schemas/question.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Analytics.name, schema: AnalyticsSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: Result.name, schema: ResultSchema },
      { name: ExamSession.name, schema: ExamSessionSchema },
      { name: Question.name, schema: QuestionSchema },
    ]),
  ],
  providers: [ExamAnalyticsService],
  controllers: [ExamAnalyticsController],
  exports: [MongooseModule, ExamAnalyticsService],
})
export class AnalyticsModule {}
