import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignAdminDto {
  @ApiProperty({
    description: 'Name of the organization admin',
    example: 'John Doe',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Email address of the organization admin',
    example: 'admin@techcorp.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Temporary password for the admin (will be sent via email)',
    example: 'TempPass@123',
    required: false,
  })
  @IsString()
  @IsOptional()
  password?: string;
}
