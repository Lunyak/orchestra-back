import {
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class SelectedStepDto {
  @IsString()
  sceneId!: string;

  @IsInt()
  stepId!: number;
}

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedSceneIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedStepDto)
  selectedSteps?: SelectedStepDto[];
}
