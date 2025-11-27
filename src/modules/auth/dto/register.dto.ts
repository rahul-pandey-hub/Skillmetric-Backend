import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/schemas/user.schema';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ADMIN })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ApiProperty({ example: 'STU001', required: false })
  @IsOptional()
  @IsString()
  studentId?: string;
}
