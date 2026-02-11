import { IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateRehearsalDto {
  @IsString()
  projectSlug: string;

  @IsString()
  @MaxLength(140)
  title: string;

  @IsISO8601()
  startsAt: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMin?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

