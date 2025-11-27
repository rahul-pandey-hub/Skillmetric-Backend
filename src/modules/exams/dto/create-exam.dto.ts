import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum, IsBoolean, IsDate, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExamStatus } from '../schemas/exam.schema';

class ProctoringSettingsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ example: 3 })
  @IsNumber()
  @Min(0)
  violationWarningLimit: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  webcamRequired: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  screenRecording: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  tabSwitchDetection: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  copyPasteDetection: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  rightClickDisabled: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  devToolsDetection: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  fullscreenRequired: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  autoSubmitOnViolation: boolean;
}

class ScheduleDto {
  @ApiProperty({ example: '2024-12-01T10:00:00Z' })
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty({ example: '2024-12-01T12:00:00Z' })
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @ApiProperty({ example: false })
  @IsBoolean()
  lateSubmissionAllowed: boolean;
}

class GradingDto {
  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  totalMarks: number;

  @ApiProperty({ example: 40 })
  @IsNumber()
  @Min(0)
  passingMarks: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  negativeMarking: boolean;

  @ApiPropertyOptional({ example: 0.25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  negativeMarkValue?: number;
}

class SettingsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  shuffleQuestions: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  shuffleOptions: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  showResultsImmediately: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  allowReview: boolean;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  attemptsAllowed: number;
}

export class CreateExamDto {
  @ApiProperty({ example: 'Data Structures Final Exam' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'DS-FINAL-2024' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'Final examination covering all topics from the semester' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 120 })
  @IsNumber()
  @Min(1)
  duration: number; // in minutes

  @ApiPropertyOptional({ enum: ExamStatus, example: ExamStatus.DRAFT })
  @IsOptional()
  @IsEnum(ExamStatus)
  status?: ExamStatus;

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questions?: string[];

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enrolledStudents?: string[];

  @ApiProperty({ type: ProctoringSettingsDto })
  @ValidateNested()
  @Type(() => ProctoringSettingsDto)
  proctoringSettings: ProctoringSettingsDto;

  @ApiProperty({ type: ScheduleDto })
  @ValidateNested()
  @Type(() => ScheduleDto)
  schedule: ScheduleDto;

  @ApiProperty({ type: GradingDto })
  @ValidateNested()
  @Type(() => GradingDto)
  grading: GradingDto;

  @ApiProperty({ type: SettingsDto })
  @ValidateNested()
  @Type(() => SettingsDto)
  settings: SettingsDto;
}
