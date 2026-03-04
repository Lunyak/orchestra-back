import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertProjectRoleDto {
  @IsString()
  @MaxLength(80)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  description?: string;

  /** Optional aliases for matching role names from text */
  @IsOptional()
  @IsArray()
  aliases?: string[];
}
