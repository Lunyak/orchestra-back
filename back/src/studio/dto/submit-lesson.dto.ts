import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitLessonDto {
  @IsIn(['complete', 'video'])
  mode!: 'complete' | 'video';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
