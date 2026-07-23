import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  lessonId?: string | null;

  @IsOptional()
  @IsString()
  dueAt?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsEmail({}, { each: true })
  targetEmails?: string[];
}
