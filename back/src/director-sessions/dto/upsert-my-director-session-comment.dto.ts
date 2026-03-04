import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertMyDirectorSessionCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;
}

