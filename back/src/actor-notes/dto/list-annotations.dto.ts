import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, MaxLength, Min } from 'class-validator';

export class ListAnnotationsDto {
  @IsString()
  @MaxLength(120)
  projectSlug: string;

  @IsString()
  @MaxLength(80)
  sceneName: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sceneId: number;

  @IsIn(['markdown', 'playMarkdown', 'explicationMarkdown'])
  field: 'markdown' | 'playMarkdown' | 'explicationMarkdown';
}
