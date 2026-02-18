import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAnnotationDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  noteText?: string;
}

