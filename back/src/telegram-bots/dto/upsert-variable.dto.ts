import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertBotVariableDto {
  @IsString()
  @MaxLength(2000)
  value!: string;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}

