import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CandidateInvitationDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class SendInvitationsDto {
  @ApiProperty({
    type: [CandidateInvitationDto],
    description: 'List of candidates to invite',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CandidateInvitationDto)
  candidates: CandidateInvitationDto[];

  @ApiProperty({
    example: 'Please complete this technical assessment',
    required: false,
  })
  @IsString()
  @IsOptional()
  invitationNote?: string;

  @ApiProperty({
    example: 'We look forward to reviewing your submission!',
    required: false,
  })
  @IsString()
  @IsOptional()
  customMessage?: string;

  @ApiProperty({
    example: 7,
    description: 'Number of days until invitation expires (overrides exam default)',
    required: false,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  validityDays?: number;
}
