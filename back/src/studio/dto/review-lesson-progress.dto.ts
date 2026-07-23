import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewLessonProgressDto {
  @IsIn(['completed', 'rejected'])
  status!: 'completed' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewComment?: string;
}
