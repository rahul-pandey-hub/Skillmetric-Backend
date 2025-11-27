import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProctoringGateway } from './gateways/proctoring.gateway';
import { ExamSession, ExamSessionSchema } from './schemas/exam-session.schema';
import { Violation, ViolationSchema } from './schemas/violation.schema';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import { ProctoringController } from './controllers/proctoring.controller';
import { ProctoringService } from './services/proctoring.service';
import { ResultsModule } from '../results/results.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExamSession.name, schema: ExamSessionSchema },
      { name: Violation.name, schema: ViolationSchema },
      { name: Exam.name, schema: ExamSchema },
    ]),
    ResultsModule,
  ],
  controllers: [ProctoringController],
  providers: [ProctoringGateway, ProctoringService],
  exports: [ProctoringService],
})
export class ProctoringModule {}
