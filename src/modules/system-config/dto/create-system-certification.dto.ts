import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CertificationType,
  CertificationValidity,
} from '../schemas/system-certification.schema';

class CertificationCriteriaDto {
  @ApiPropertyOptional({ default: 70 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minimumScore?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumAssessments?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requireAllSkills?: boolean;
}

class CertificateDesignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  templateUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  badgeUrl?: string;

  @ApiPropertyOptional({ default: '#1976d2' })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional({ default: '#424242' })
  @IsOptional()
  @IsString()
  secondaryColor?: string;
}

export class CreateSystemCertificationDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ enum: CertificationType })
  @IsEnum(CertificationType)
  type: CertificationType;

  @ApiProperty({
    enum: CertificationValidity,
    default: CertificationValidity.LIFETIME,
  })
  @IsEnum(CertificationValidity)
  validity: CertificationValidity;

  @ApiProperty()
  @ValidateNested()
  @Type(() => CertificationCriteriaDto)
  criteria: CertificationCriteriaDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CertificateDesignDto)
  design?: CertificateDesignDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSystemCertificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: CertificationType })
  @IsOptional()
  @IsEnum(CertificationType)
  type?: CertificationType;

  @ApiPropertyOptional({ enum: CertificationValidity })
  @IsOptional()
  @IsEnum(CertificationValidity)
  validity?: CertificationValidity;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CertificationCriteriaDto)
  criteria?: CertificationCriteriaDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CertificateDesignDto)
  design?: CertificateDesignDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
