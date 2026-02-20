import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTelegramBotDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  ownerTelegramId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  adminTelegramId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  groupChatId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  attendanceThreadId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  announcementsThreadId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  defaultProjectSlug?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  quizGroupChatId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  quizThreadId?: string | null;
}

