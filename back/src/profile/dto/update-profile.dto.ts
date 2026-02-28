import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  telegramUsername?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  telegramId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;

  @IsOptional()
  @IsObject()
  availabilityCalendar?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  availabilityTimeRanges?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sex?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  birthday?: string;
}
