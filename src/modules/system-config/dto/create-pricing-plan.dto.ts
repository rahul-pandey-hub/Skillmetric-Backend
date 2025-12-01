import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanTier } from '../schemas/pricing-plan.schema';

class PlanFeaturesDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  credits: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  maxConcurrentUsers: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  maxExamsPerMonth: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStorageGB?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  brandingEnabled?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  customEmailTemplates?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  advancedProctoring?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  apiAccess?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  bulkOperations?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  analyticsExport?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  prioritySupport?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dedicatedAccountManager?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  customIntegrations?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  whiteLabeling?: boolean;
}

class PlanPricingDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  monthly: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quarterly: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  yearly: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class CreatePricingPlanDto {
  @ApiProperty({ enum: PlanTier })
  @IsEnum(PlanTier)
  tier: PlanTier;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => PlanPricingDto)
  pricing: PlanPricingDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => PlanFeaturesDto)
  features: PlanFeaturesDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdatePricingPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => PlanPricingDto)
  pricing?: PlanPricingDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => PlanFeaturesDto)
  features?: PlanFeaturesDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
