import {
  IsString,
  IsNumber,
  IsArray,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  ArrayMinSize,
  IsEnum,
  MaxLength,
  ValidateIf,
  IsInt,
} from 'class-validator';
import {
  QuestionType,
  DifficultyLevel,
  QuestionCategory,
} from '../../questions/schemas/question.schema';

export class GenerateQuestionsDto {
  @IsEnum(QuestionCategory, {
    message: 'mainTopic must be a valid question category',
  })
  mainTopic: QuestionCategory;

  @IsString()
  @MaxLength(100, { message: 'subTopic must not exceed 100 characters' })
  subTopic: string;

  @IsEnum(DifficultyLevel, {
    message: 'difficulty must be EASY, MEDIUM, HARD, or EXPERT',
  })
  difficulty: DifficultyLevel;

  @IsInt({ message: 'numberOfQuestions must be an integer' })
  @Min(1, { message: 'numberOfQuestions must be at least 1' })
  @Max(50, { message: 'numberOfQuestions cannot exceed 50' })
  numberOfQuestions: number;

  @IsArray({ message: 'questionTypes must be an array' })
  @ArrayMinSize(1, { message: 'At least one question type must be selected' })
  @IsEnum(QuestionType, {
    each: true,
    message: 'Each questionType must be a valid type',
  })
  questionTypes: QuestionType[];

  @IsNumber({}, { message: 'marksPerQuestion must be a number' })
  @Min(0.5, { message: 'marksPerQuestion must be at least 0.5' })
  @Max(10, { message: 'marksPerQuestion cannot exceed 10' })
  marksPerQuestion: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'additionalInstructions must not exceed 500 characters',
  })
  additionalInstructions?: string;

  @IsBoolean({ message: 'includeNegativeMarking must be a boolean' })
  includeNegativeMarking: boolean;

  @IsOptional()
  @ValidateIf((o) => o.includeNegativeMarking === true)
  @IsNumber({}, { message: 'negativeMarks must be a number' })
  @Min(0, { message: 'negativeMarks must be at least 0' })
  @Max(10, { message: 'negativeMarks cannot exceed 10' })
  negativeMarks?: number;

  @IsBoolean({ message: 'includeExplanations must be a boolean' })
  includeExplanations: boolean;

  @IsBoolean({ message: 'includeHints must be a boolean' })
  includeHints: boolean;

  @IsInt({ message: 'estimatedTime must be an integer' })
  @Min(30, { message: 'estimatedTime must be at least 30 seconds' })
  @Max(1800, { message: 'estimatedTime cannot exceed 1800 seconds (30 minutes)' })
  estimatedTime: number;

  @IsOptional()
  @IsArray({ message: 'tags must be an array' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  tags?: string[];
}
