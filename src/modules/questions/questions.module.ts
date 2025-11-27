import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { Question, QuestionSchema } from './schemas/question.schema';
import { QuestionsController } from './controllers/questions.controller';
import { CommandHandlers } from './commands/handlers';

@Module({
  imports: [
    CqrsModule,
    MongooseModule.forFeature([{ name: Question.name, schema: QuestionSchema }]),
  ],
  controllers: [QuestionsController],
  providers: [...CommandHandlers],
  exports: [MongooseModule],
})
export class QuestionsModule {}
