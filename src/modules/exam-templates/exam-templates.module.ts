import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { ExamTemplatesController } from './controllers/exam-templates.controller';
import { ExamTemplate, ExamTemplateSchema } from './schemas/exam-template.schema';
import { CommandHandlers } from './commands/handlers';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExamTemplate.name, schema: ExamTemplateSchema },
    ]),
    CqrsModule,
  ],
  controllers: [ExamTemplatesController],
  providers: [...CommandHandlers],
  exports: [MongooseModule],
})
export class ExamTemplatesModule {}
