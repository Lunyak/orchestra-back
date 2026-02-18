import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpsertStepNoteDto {
  @IsString()
  @MaxLength(120)
  projectSlug: string;

  @IsString()
  @MaxLength(80)
  sceneName: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  stepId: number;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;
}
