import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ExamsModule } from './modules/exams/exams.module';
import { ProctoringModule } from './modules/proctoring/proctoring.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { ResultsModule } from './modules/results/results.module';
import { StudentsModule } from './modules/students/students.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RabbitMQModule } from './modules/rabbitmq/rabbitmq.module';
import { RedisModule } from './modules/redis/redis.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { EmailModule } from './modules/email/email.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { QuestionPoolsModule } from './modules/question-pools/question-pools.module';
import { ExamTemplatesModule } from './modules/exam-templates/exam-templates.module';
import { BulkOperationsModule } from './modules/bulk-operations/bulk-operations.module';
import { CertificationsModule } from './modules/certifications/certifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ShortlistingModule } from './modules/shortlisting/shortlisting.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { OrgAdminModule } from './modules/org-admin/org-admin.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),

    // Bull Queue (Global)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),

    // CQRS
    CqrsModule,

    // Feature Modules
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ExamsModule,
    ProctoringModule,
    QuestionsModule,
    QuestionPoolsModule,
    ExamTemplatesModule,
    ResultsModule,
    BulkOperationsModule,
    CertificationsModule,
    AnalyticsModule,
    ShortlistingModule,
    SystemConfigModule,
    OrgAdminModule,
    StudentsModule,
    NotificationsModule,
    RabbitMQModule,
    RedisModule,
    WebsocketModule,
    EmailModule,
  ],
})
export class AppModule {}
