import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestionPoolDto } from './create-question-pool.dto';

export class UpdateQuestionPoolDto extends PartialType(CreateQuestionPoolDto) {}
