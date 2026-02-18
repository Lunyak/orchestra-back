import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class GetStepNoteDto {
  @IsString()
  @MaxLength(120)
  projectSlug: string;

  @IsString()
  @MaxLength(80)
  sceneName: string;

  @IsInt()
  @Min(1)
  stepId: number;
}
