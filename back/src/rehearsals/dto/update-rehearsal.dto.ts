import { IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateRehearsalDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMin?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

