import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ProjectTaskCategory,
  ProjectTaskSource,
  ProjectTaskStatus,
} from '@prisma/client';

export class CreateProjectTaskDto {
  @IsString()
  projectSlug: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsEnum(ProjectTaskStatus)
  status?: ProjectTaskStatus;

  @IsOptional()
  @IsEnum(ProjectTaskCategory)
  category?: ProjectTaskCategory;

  @IsOptional()
  @IsEmail()
  assigneeEmail?: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}

export class UpdateProjectTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsEnum(ProjectTaskStatus)
  status?: ProjectTaskStatus;

  @IsOptional()
  @IsEnum(ProjectTaskCategory)
  category?: ProjectTaskCategory;

  @IsOptional()
  @ValidateIf((_obj, value) => value != null && value !== '')
  @IsEmail()
  assigneeEmail?: string | null;

  @IsOptional()
  @IsISO8601()
  dueAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ImportRequisiteTaskItemDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  sourceKey: string;

  @IsOptional()
  @IsEmail()
  assigneeEmail?: string;

  @IsInt()
  refSceneId: number;

  @IsInt()
  refRequisiteId: number;

  @IsString()
  refAction: string;
}

export class ImportRequisiteTasksDto {
  @IsString()
  projectSlug: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRequisiteTaskItemDto)
  tasks: ImportRequisiteTaskItemDto[];
}
