import { IsString, MaxLength, MinLength } from 'class-validator';

export class PatchTroupeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;
}
