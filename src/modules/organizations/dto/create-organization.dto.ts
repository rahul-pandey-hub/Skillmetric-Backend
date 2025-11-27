import {
  IsString,
  IsEnum,
  IsEmail,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsUrl,
  IsDateString,
  ValidateNested,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  OrganizationType,
  OrganizationStatus,
  SubscriptionPlan,
} from '../schemas/organization.schema';

class AddressDto {
  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  pincode?: string;
}

class ContactInfoDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @ValidateNested()
  @Type(() => AddressDto)
  @IsOptional()
  address?: AddressDto;
}

class SubscriptionDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  credits?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxConcurrentUsers?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxExamsPerMonth?: number;
}

class FeaturesDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedDomains?: string[];

  @IsBoolean()
  @IsOptional()
  brandingEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  customEmailTemplates?: boolean;

  @IsBoolean()
  @IsOptional()
  advancedProctoring?: boolean;

  @IsBoolean()
  @IsOptional()
  apiAccess?: boolean;

  @IsBoolean()
  @IsOptional()
  bulkOperations?: boolean;

  @IsBoolean()
  @IsOptional()
  analyticsExport?: boolean;
}

class BrandingDto {
  @IsUrl()
  @IsOptional()
  logo?: string;

  @IsString()
  @IsOptional()
  primaryColor?: string;

  @IsString()
  @IsOptional()
  secondaryColor?: string;

  @IsString()
  @IsOptional()
  customDomain?: string;
}

export class CreateOrganizationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @IsEnum(OrganizationType)
  type: OrganizationType;

  @IsEnum(OrganizationStatus)
  @IsOptional()
  status?: OrganizationStatus;

  @ValidateNested()
  @Type(() => ContactInfoDto)
  contactInfo: ContactInfoDto;

  @ValidateNested()
  @Type(() => SubscriptionDto)
  subscription: SubscriptionDto;

  @ValidateNested()
  @Type(() => FeaturesDto)
  @IsOptional()
  features?: FeaturesDto;

  @ValidateNested()
  @Type(() => BrandingDto)
  @IsOptional()
  branding?: BrandingDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  admins?: string[];
}
