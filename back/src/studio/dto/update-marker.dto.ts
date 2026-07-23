import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateMarkerDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  timeSec?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;
}
