import {
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
  IsBoolean,
  IsOptional,
  ValidateNested,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TargetLevel, TemplateCategory } from '../schemas/exam-template.schema';

class QuestionDistributionDto {
  @IsString()
  category: string;

  @IsString()
  @IsOptional()
  subcategory?: string;

  @IsNumber()
  @Min(1)
  count: number;

  @IsString()
  @IsOptional()
  difficulty?: string;

  @IsNumber()
  @Min(0)
  marks: number;

  @IsString()
  @IsOptional()
  poolId?: string;
}

class ProctoringSettingsDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsNumber()
  @IsOptional()
  violationWarningLimit?: number;

  @IsBoolean()
  @IsOptional()
  webcamRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  screenRecording?: boolean;

  @IsBoolean()
  @IsOptional()
  tabSwitchDetection?: boolean;

  @IsBoolean()
  @IsOptional()
  copyPasteDetection?: boolean;

  @IsBoolean()
  @IsOptional()
  rightClickDisabled?: boolean;

  @IsBoolean()
  @IsOptional()
  devToolsDetection?: boolean;

  @IsBoolean()
  @IsOptional()
  fullscreenRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  autoSubmitOnViolation?: boolean;

  @IsBoolean()
  @IsOptional()
  faceDetection?: boolean;

  @IsBoolean()
  @IsOptional()
  multipleFaceDetection?: boolean;

  @IsBoolean()
  @IsOptional()
  mobileDetection?: boolean;
}

class SettingsDto {
  @IsBoolean()
  @IsOptional()
  shuffleQuestions?: boolean;

  @IsBoolean()
  @IsOptional()
  shuffleOptions?: boolean;

  @IsBoolean()
  @IsOptional()
  showResultsImmediately?: boolean;

  @IsBoolean()
  @IsOptional()
  allowReview?: boolean;

  @IsBoolean()
  @IsOptional()
  showCorrectAnswers?: boolean;

  @IsNumber()
  @IsOptional()
  attemptsAllowed?: number;
}

export class CreateExamTemplateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  targetRole?: string;

  @IsEnum(TargetLevel)
  @IsOptional()
  targetLevel?: TargetLevel;

  @IsEnum(TemplateCategory)
  category: TemplateCategory;

  @IsNumber()
  @Min(1)
  duration: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDistributionDto)
  questionDistribution: QuestionDistributionDto[];

  @IsNumber()
  @Min(0)
  totalMarks: number;

  @IsNumber()
  @Min(0)
  passingMarks: number;

  @ValidateNested()
  @Type(() => ProctoringSettingsDto)
  @IsOptional()
  proctoringSettings?: ProctoringSettingsDto;

  @ValidateNested()
  @Type(() => SettingsDto)
  @IsOptional()
  settings?: SettingsDto;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsBoolean()
  @IsOptional()
  isPremium?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
