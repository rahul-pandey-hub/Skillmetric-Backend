import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExamMonitoringService } from './services/exam-monitoring.service';
import { ExamMonitoringController } from './controllers/exam-monitoring.controller';
import { MonitoringGateway } from './gateways/monitoring.gateway';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import { ExamSession, ExamSessionSchema } from '../proctoring/schemas/exam-session.schema';
import { Result, ResultSchema } from '../results/schemas/result.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: ExamSession.name, schema: ExamSessionSchema },
      { name: Result.name, schema: ResultSchema },
    ]),
  ],
  providers: [ExamMonitoringService, MonitoringGateway],
  controllers: [ExamMonitoringController],
  exports: [ExamMonitoringService, MonitoringGateway],
})
export class MonitoringModule {}
