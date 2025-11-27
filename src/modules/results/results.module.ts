import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Result, ResultSchema } from './schemas/result.schema';
import { Question, QuestionSchema } from '../questions/schemas/question.schema';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import { ExamSession, ExamSessionSchema } from '../proctoring/schemas/exam-session.schema';
import { GradingService } from './services/grading.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Result.name, schema: ResultSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: ExamSession.name, schema: ExamSessionSchema },
    ]),
  ],
  providers: [GradingService],
  exports: [MongooseModule, GradingService],
})
export class ResultsModule {}
