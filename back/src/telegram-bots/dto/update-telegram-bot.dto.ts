import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

  @IsOptional()
  @IsIn(['on_publish', 'same_day', 'advance'])
  callNotifyMode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  callNotifyAdvanceDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  callNotifyHour?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  availabilityRemindEnabled?: boolean;
}
