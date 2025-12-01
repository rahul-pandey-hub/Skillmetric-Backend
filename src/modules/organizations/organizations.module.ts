import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { OrganizationsController } from './controllers/organizations.controller';
import { SuperAdminController } from './controllers/super-admin.controller';
import { SuperAdminAnalyticsController } from './controllers/super-admin-analytics.controller';
import {
  Organization,
  OrganizationSchema,
} from './schemas/organization.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import { Result, ResultSchema } from '../results/schemas/result.schema';
import { CommandHandlers } from './commands/handlers';
import { AnalyticsService } from './services/analytics.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: User.name, schema: UserSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: Result.name, schema: ResultSchema },
    ]),
    CqrsModule,
    forwardRef(() => EmailModule),
  ],
  controllers: [
    OrganizationsController,
    SuperAdminController,
    SuperAdminAnalyticsController,
  ],
  providers: [...CommandHandlers, AnalyticsService],
  exports: [MongooseModule],
})
export class OrganizationsModule {}
