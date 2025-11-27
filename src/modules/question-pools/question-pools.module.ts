import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { QuestionPoolsController } from './controllers/question-pools.controller';
import { QuestionPool, QuestionPoolSchema } from './schemas/question-pool.schema';
import { CommandHandlers } from './commands/handlers';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuestionPool.name, schema: QuestionPoolSchema },
    ]),
    CqrsModule,
  ],
  controllers: [QuestionPoolsController],
  providers: [...CommandHandlers],
  exports: [MongooseModule],
})
export class QuestionPoolsModule {}
