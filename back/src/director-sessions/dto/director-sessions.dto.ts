import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpsertDirectorSessionsDto {
  @IsOptional()
  @IsArray()
  sessions?: any[];

  @IsOptional()
  @IsString()
  clientUpdatedAt?: string;
}

