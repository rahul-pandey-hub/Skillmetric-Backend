import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class AddQuestionsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  questionIds: string[];
}
