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

class SelectedSceneDto {
  @IsString()
  playbookId!: string;

  @IsInt()
  sceneId!: number;
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
  calendarWorkspaceIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedPlaybookIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedSceneDto)
  selectedScenes?: SelectedSceneDto[];
}
