import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsArray,
  IsNumber,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsBoolean,
  Min,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsObject,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType, DifficultyLevel } from '../schemas/question.schema';

class QuestionOptionDto {
  @ApiProperty({ example: 'opt1', description: 'Unique option identifier' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ example: 'Paris', description: 'Option text' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Option text cannot be empty' })
  @MaxLength(500, { message: 'Option text cannot exceed 500 characters' })
  text: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether this option is correct',
  })
  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;
}

class MediaDto {
  @ApiPropertyOptional({ example: 'https://example.com/image.png' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: 'https://example.com/video.mp4' })
  @IsOptional()
  @IsString()
  video?: string;

  @ApiPropertyOptional({ example: 'https://example.com/audio.mp3' })
  @IsOptional()
  @IsString()
  audio?: string;
}

@ValidatorConstraint({ name: 'HasCorrectAnswer', async: false })
class HasCorrectAnswerConstraint implements ValidatorConstraintInterface {
  validate(options: QuestionOptionDto[], args: any) {
    if (!options || options.length === 0) return true; // Optional for non-MC questions
    return options.some((option) => option.isCorrect === true);
  }

  defaultMessage() {
    return 'At least one option must be marked as correct';
  }
}

@ValidatorConstraint({ name: 'ValidateOptionsForType', async: false })
class ValidateOptionsForTypeConstraint
  implements ValidatorConstraintInterface
{
  validate(options: QuestionOptionDto[], args: any) {
    const type = (args.object as any).type;

    if (
      type === QuestionType.MULTIPLE_CHOICE ||
      type === QuestionType.TRUE_FALSE
    ) {
      // Options required for MC and T/F
      if (!options || options.length < 2) {
        return false;
      }
    }

    return true;
  }

  defaultMessage(args: any) {
    const type = (args.object as any).type;
    if (
      type === QuestionType.MULTIPLE_CHOICE ||
      type === QuestionType.TRUE_FALSE
    ) {
      return 'At least 2 options are required for Multiple Choice and True/False questions';
    }
    return 'Invalid options configuration';
  }
}

export class CreateQuestionDto {
  @ApiProperty({
    example: 'What is the capital of France?',
    description: 'The question text',
  })
  @IsString()
  @IsNotEmpty({ message: 'Question text is required' })
  @MinLength(10, { message: 'Question text must be at least 10 characters' })
  @MaxLength(2000, { message: 'Question text cannot exceed 2000 characters' })
  text: string;

  @ApiProperty({
    enum: QuestionType,
    example: QuestionType.MULTIPLE_CHOICE,
    description: 'Type of question',
  })
  @IsEnum(QuestionType, { message: 'Invalid question type' })
  type: QuestionType;

  @ApiPropertyOptional({
    enum: DifficultyLevel,
    example: DifficultyLevel.MEDIUM,
    description: 'Difficulty level',
    default: DifficultyLevel.MEDIUM,
  })
  @IsOptional()
  @IsEnum(DifficultyLevel, { message: 'Invalid difficulty level' })
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({
    type: [QuestionOptionDto],
    description:
      'Answer options (required for Multiple Choice and True/False, min 2 options)',
    example: [
      { id: 'opt1', text: 'Paris', isCorrect: true },
      { id: 'opt2', text: 'London', isCorrect: false },
      { id: 'opt3', text: 'Berlin', isCorrect: false },
      { id: 'opt4', text: 'Madrid', isCorrect: false },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  @Validate(ValidateOptionsForTypeConstraint)
  @Validate(HasCorrectAnswerConstraint)
  options?: QuestionOptionDto[];

  @ApiPropertyOptional({
    example: 'opt1',
    description:
      'The correct answer (option id for MC, boolean for T/F, string for Fill Blank/Short Answer, null for Essay)',
  })
  @IsOptional()
  correctAnswer?: any;

  @ApiPropertyOptional({
    example: 'Paris is the capital and largest city of France',
    description: 'Explanation for the correct answer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'Explanation cannot exceed 1000 characters',
  })
  explanation?: string;

  @ApiProperty({
    example: 1,
    description: 'Marks for correct answer',
    default: 1,
  })
  @IsNumber()
  @Min(0.5, { message: 'Marks must be at least 0.5' })
  marks: number;

  @ApiPropertyOptional({
    example: 0.25,
    description: 'Negative marks for incorrect answer',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Negative marks cannot be less than 0' })
  negativeMarks?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['geography', 'capitals', 'europe'],
    description: 'Tags for categorizing the question',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    example: 'Geography',
    description: 'Category of the question',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Category cannot exceed 100 characters' })
  category?: string;

  @ApiPropertyOptional({
    type: MediaDto,
    description: 'Media resources for the question',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MediaDto)
  media?: MediaDto;
}
