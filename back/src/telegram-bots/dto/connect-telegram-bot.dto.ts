import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ConnectTelegramBotDto {
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;
}

