import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Result, ResultSchema } from './schemas/result.schema';
import { Question, QuestionSchema } from '../questions/schemas/question.schema';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import { ExamSession, ExamSessionSchema } from '../proctoring/schemas/exam-session.schema';
import { Violation, ViolationSchema } from '../proctoring/schemas/violation.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { GradingService } from './services/grading.service';
import { EmailModule } from '../email/email.module';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Result.name, schema: ResultSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: ExamSession.name, schema: ExamSessionSchema },
      { name: Violation.name, schema: ViolationSchema },
      { name: User.name, schema: UserSchema },
    ]),
    EmailModule,
    CertificatesModule,
  ],
  providers: [GradingService],
  exports: [MongooseModule, GradingService],
})
export class ResultsModule {}
