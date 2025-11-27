import { PartialType } from '@nestjs/swagger';
import { CreateQuestionDto } from './create-question.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {
  @ApiPropertyOptional({
    example: true,
    description: 'Whether the question is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
