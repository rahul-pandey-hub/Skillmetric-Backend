import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { Exam, ExamSchema } from './schemas/exam.schema';
import { Question, QuestionSchema } from '../questions/schemas/question.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ExamSession, ExamSessionSchema } from '../proctoring/schemas/exam-session.schema';
import { Result, ResultSchema } from '../results/schemas/result.schema';
import { ExamsController } from './controllers/exams.controller';
import { StudentExamsController } from './controllers/student-exams.controller';
import { CreateExamHandler } from './commands/handlers/create-exam.handler';
import { AddQuestionsToExamHandler } from './commands/handlers/add-questions-to-exam.handler';
import { RemoveQuestionsFromExamHandler } from './commands/handlers/remove-questions-from-exam.handler';
import { EnrollStudentsHandler } from './commands/handlers/enroll-students.handler';
import { EmailModule } from '../email/email.module';

const CommandHandlers = [
  CreateExamHandler,
  AddQuestionsToExamHandler,
  RemoveQuestionsFromExamHandler,
  EnrollStudentsHandler,
];

@Module({
  imports: [
    CqrsModule,
    EmailModule,
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: User.name, schema: UserSchema },
      { name: ExamSession.name, schema: ExamSessionSchema },
      { name: Result.name, schema: ResultSchema },
    ]),
  ],
  controllers: [ExamsController, StudentExamsController],
  providers: [...CommandHandlers],
  exports: [MongooseModule],
})
export class ExamsModule {}
