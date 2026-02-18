import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAnnotationDto {
  @IsString()
  @MaxLength(120)
  projectSlug: string;

  @IsString()
  @MaxLength(80)
  sceneName: string;

  @IsInt()
  @Min(1)
  stepId: number;

  @IsIn(['markdown', 'playMarkdown'])
  field: 'markdown' | 'playMarkdown';

  @IsInt()
  @Min(0)
  startOffset: number;

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
