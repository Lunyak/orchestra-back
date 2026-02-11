import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';

export class BotProfileDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  telegramUsername?: string;

  @IsOptional()
  @IsString()
  telegramId?: string;
}

export class BotProfilesUpsertDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BotProfileDto)
  profiles: BotProfileDto[];
}

