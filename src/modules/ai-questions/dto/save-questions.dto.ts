import {
  IsArray,
  IsOptional,
  IsBoolean,
  IsString,
  ArrayMinSize,
  IsMongoId,
  ValidateIf,
} from 'class-validator';

export class SaveOptionsDto {
  @IsOptional()
  @IsBoolean()
  addToQuestionPool?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.addToQuestionPool === true)
  @IsMongoId({ message: 'questionPoolId must be a valid MongoDB ObjectId' })
  questionPoolId?: string;

  @IsOptional()
  @IsBoolean()
  markAsPublic?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalTags?: string[];

  @IsOptional()
  customMetadata?: Record<string, any>;
}

export class SaveQuestionsDto {
  @IsArray({ message: 'questionIds must be an array' })
  @ArrayMinSize(1, { message: 'At least one question must be selected to save' })
  @IsString({ each: true, message: 'Each questionId must be a string' })
  questionIds: string[];

  @IsOptional()
  options?: SaveOptionsDto;
}
