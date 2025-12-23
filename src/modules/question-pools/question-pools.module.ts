import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { QuestionPoolsController } from './controllers/question-pools.controller';
import { QuestionPool, QuestionPoolSchema } from './schemas/question-pool.schema';
import { Question, QuestionSchema } from '../questions/schemas/question.schema';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import { PoolSelectionService } from './services/pool-selection.service';
import { CommandHandlers } from './commands/handlers';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuestionPool.name, schema: QuestionPoolSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Exam.name, schema: ExamSchema },
    ]),
    CqrsModule,
  ],
  controllers: [QuestionPoolsController],
  providers: [...CommandHandlers, PoolSelectionService],
  exports: [MongooseModule, PoolSelectionService],
})
export class QuestionPoolsModule {}
