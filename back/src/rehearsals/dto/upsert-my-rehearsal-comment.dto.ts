import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertMyRehearsalCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;
}

