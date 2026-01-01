import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { Exam, ExamSchema } from './schemas/exam.schema';
import { ExamInvitation, ExamInvitationSchema } from './schemas/exam-invitation.schema';
import { Question, QuestionSchema } from '../questions/schemas/question.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ExamSession, ExamSessionSchema } from '../proctoring/schemas/exam-session.schema';
import { Result, ResultSchema } from '../results/schemas/result.schema';
import { Violation, ViolationSchema } from '../proctoring/schemas/violation.schema';
import { ExamsController } from './controllers/exams.controller';
import { StudentExamsController } from './controllers/student-exams.controller';
import { InvitationExamsController } from './controllers/invitation-exams.controller';
import { RecruitmentResultsController } from './controllers/recruitment-results.controller';
import { CreateExamHandler } from './commands/handlers/create-exam.handler';
import { AddQuestionsToExamHandler } from './commands/handlers/add-questions-to-exam.handler';
import { RemoveQuestionsFromExamHandler } from './commands/handlers/remove-questions-from-exam.handler';
import { EnrollCandidatesHandler } from './commands/handlers/enroll-candidates.handler';
import { SendInvitationsHandler } from './commands/handlers/send-invitations.handler';
import { InvitationTokenService } from './services/invitation-token.service';
import { ExpireInvitationsJob } from './jobs/expire-invitations.job';
import { InvitationReminderJob } from './jobs/invitation-reminder.job';
import { EmailModule } from '../email/email.module';

const CommandHandlers = [
  CreateExamHandler,
  AddQuestionsToExamHandler,
  RemoveQuestionsFromExamHandler,
  EnrollCandidatesHandler,
  SendInvitationsHandler,
];

const Services = [
  InvitationTokenService,
];

const Jobs = [
  ExpireInvitationsJob,
  InvitationReminderJob,
];

@Module({
  imports: [
    CqrsModule,
    EmailModule,
    ScheduleModule.forRoot(), // Enable cron jobs
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: ExamInvitation.name, schema: ExamInvitationSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: User.name, schema: UserSchema },
      { name: ExamSession.name, schema: ExamSessionSchema },
      { name: Result.name, schema: ResultSchema },
      { name: Violation.name, schema: ViolationSchema },
    ]),
  ],
  controllers: [
    ExamsController,
    StudentExamsController,
    InvitationExamsController,
    RecruitmentResultsController,
  ],
  providers: [
    ...CommandHandlers,
    ...Services,
    ...Jobs,
  ],
  exports: [
    MongooseModule,
    InvitationTokenService, // Export for use in guards
  ],
})
export class ExamsModule {}
