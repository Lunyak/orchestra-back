import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class GradeSubmissionDto {
  @IsInt()
  @Min(1)
  @Max(5)
  grade!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  gradeComment?: string;
}
