import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

// Schemas
import { AIGeneration, AIGenerationSchema } from './schemas/ai-generation.schema';
import { Question, QuestionSchema } from '../questions/schemas/question.schema';

// Controllers
import { AIQuestionsController } from './controllers/ai-questions.controller';

// Services
import {
  AIGenerationService,
  PromptBuilderService,
  ResponseParserService,
  QuestionValidatorService,
} from './services';

// Providers
import { GeminiProviderService } from './providers/gemini-provider.service';

// Command Handlers
import {
  GenerateQuestionsHandler,
  SaveAIQuestionsHandler,
  RegenerateQuestionHandler,
} from './commands/handlers';

const CommandHandlers = [
  GenerateQuestionsHandler,
  SaveAIQuestionsHandler,
  RegenerateQuestionHandler,
];

const Services = [
  AIGenerationService,
  PromptBuilderService,
  ResponseParserService,
  QuestionValidatorService,
];

const Providers = [GeminiProviderService];

@Module({
  imports: [
    CqrsModule,
    ConfigModule,
    MongooseModule.forFeature([
      { name: AIGeneration.name, schema: AIGenerationSchema },
      { name: Question.name, schema: QuestionSchema }, // Import Question model for saving
    ]),
  ],
  controllers: [AIQuestionsController],
  providers: [...Services, ...Providers, ...CommandHandlers],
  exports: [
    AIGenerationService,
    MongooseModule, // Export models for use in other modules
  ],
})
export class AIQuestionsModule {}
