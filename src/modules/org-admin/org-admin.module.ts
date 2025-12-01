import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Schemas
import { User, UserSchema } from '../users/schemas/user.schema';
import { Question, QuestionSchema } from '../questions/schemas/question.schema';
import { Organization, OrganizationSchema } from '../organizations/schemas/organization.schema';

// Controllers
import { UserManagementController } from './controllers/user-management.controller';
import { QuestionManagementController } from './controllers/question-management.controller';
import { OrgAnalyticsController } from './controllers/org-analytics.controller';
import { OrgSettingsController } from './controllers/org-settings.controller';

// Services
import { UserManagementService } from './services/user-management.service';
import { QuestionManagementService } from './services/question-management.service';
import { OrgAnalyticsService } from './services/org-analytics.service';
import { OrgSettingsService } from './services/org-settings.service';

// Import Email Module for sending welcome emails
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    EmailModule,
  ],
  controllers: [
    UserManagementController,
    QuestionManagementController,
    OrgAnalyticsController,
    OrgSettingsController,
  ],
  providers: [
    UserManagementService,
    QuestionManagementService,
    OrgAnalyticsService,
    OrgSettingsService,
  ],
  exports: [
    UserManagementService,
    QuestionManagementService,
    OrgAnalyticsService,
    OrgSettingsService,
  ],
})
export class OrgAdminModule {}
