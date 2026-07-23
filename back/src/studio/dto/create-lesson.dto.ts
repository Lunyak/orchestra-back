import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;

  @IsOptional()
  @IsIn(['complete', 'video'])
  taskType?: 'complete' | 'video';

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  taskPrompt?: string;
}
