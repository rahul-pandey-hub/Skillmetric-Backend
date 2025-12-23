import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CertificateService } from './services/certificate.service';
import { CertificateController } from './controllers/certificate.controller';
import { Result, ResultSchema } from '../results/schemas/result.schema';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Result.name, schema: ResultSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CertificateController],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificatesModule {}
