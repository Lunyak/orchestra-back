import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateVideoDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  assignmentId?: string | null;
}
