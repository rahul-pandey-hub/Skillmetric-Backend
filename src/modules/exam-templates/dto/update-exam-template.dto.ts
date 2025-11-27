import { PartialType } from '@nestjs/mapped-types';
import { CreateExamTemplateDto } from './create-exam-template.dto';

export class UpdateExamTemplateDto extends PartialType(CreateExamTemplateDto) {}
