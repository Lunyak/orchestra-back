import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAnnotationDto {
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

  @IsIn(['markdown', 'playMarkdown', 'explicationMarkdown'])
  field: 'markdown' | 'playMarkdown' | 'explicationMarkdown';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  startOffset: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  endOffset: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  selectedText?: string;

  @IsString()
  @MaxLength(10000)
  noteText: string;
}
