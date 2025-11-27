import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShortlistingService } from './services/shortlisting.service';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import { Result, ResultSchema } from '../results/schemas/result.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: Result.name, schema: ResultSchema },
    ]),
  ],
  providers: [ShortlistingService],
  exports: [ShortlistingService],
})
export class ShortlistingModule {}
