import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CandidateDataDto {
  @ApiProperty({ example: 'John Doe', description: 'Candidate name' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Candidate email',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}

export class EnrollCandidatesDto {
  @ApiProperty({
    type: [CandidateDataDto],
    description: 'Array of candidates to enroll',
    example: [
      { name: 'John Doe', email: 'john.doe@example.com' },
      { name: 'Jane Smith', email: 'jane.smith@example.com' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one candidate is required' })
  @ValidateNested({ each: true })
  @Type(() => CandidateDataDto)
  candidates: CandidateDataDto[];
}
