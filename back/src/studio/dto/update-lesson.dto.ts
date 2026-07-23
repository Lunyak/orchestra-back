import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string | null;

  @IsOptional()
  @IsIn(['complete', 'video'])
  taskType?: 'complete' | 'video';

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  taskPrompt?: string | null;
}
