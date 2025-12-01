import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemConfigController } from './controllers/system-config.controller';
import { SystemConfigService } from './services/system-config.service';
import {
  ExamTemplate,
  ExamTemplateSchema,
} from './schemas/exam-template.schema';
import {
  QuestionPool,
  QuestionPoolSchema,
} from './schemas/question-pool.schema';
import {
  SystemCertification,
  SystemCertificationSchema,
} from './schemas/system-certification.schema';
import {
  PricingPlan,
  PricingPlanSchema,
} from './schemas/pricing-plan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExamTemplate.name, schema: ExamTemplateSchema },
      { name: QuestionPool.name, schema: QuestionPoolSchema },
      { name: SystemCertification.name, schema: SystemCertificationSchema },
      { name: PricingPlan.name, schema: PricingPlanSchema },
    ]),
  ],
  controllers: [SystemConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService, MongooseModule],
})
export class SystemConfigModule {}
