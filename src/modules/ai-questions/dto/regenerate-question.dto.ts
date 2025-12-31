import { IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegenerateQuestionDto {
  @IsInt({ message: 'questionIndex must be an integer' })
  @Min(0, { message: 'questionIndex must be at least 0' })
  questionIndex: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'additionalInstructions must not exceed 500 characters',
  })
  additionalInstructions?: string;
}
