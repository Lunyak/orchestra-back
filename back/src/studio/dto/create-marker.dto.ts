import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class CreateMarkerDto {
  @IsInt()
  @Min(0)
  timeSec!: number;

  @IsString()
  @MaxLength(2000)
  body!: string;
}
