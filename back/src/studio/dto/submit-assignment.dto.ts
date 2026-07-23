import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class SubmitAssignmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  videoUrl?: string;
}
