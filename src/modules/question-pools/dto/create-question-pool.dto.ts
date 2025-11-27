import {
  IsString,
  IsArray,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateQuestionPoolDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @IsString()
  category: string;

  @IsString()
  @IsOptional()
  subcategory?: string;

  @IsString()
  @IsOptional()
  difficulty?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  questions?: string[];

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
