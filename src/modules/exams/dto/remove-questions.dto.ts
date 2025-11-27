import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, ArrayMinSize } from 'class-validator';

export class RemoveQuestionsDto {
  @ApiProperty({
    description: 'Array of question IDs to remove from the exam',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    type: [String],
  })
  @IsArray()
  @IsNotEmpty()
  @ArrayMinSize(1)
  questionIds: string[];
}
