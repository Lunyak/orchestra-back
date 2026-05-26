import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpsertProjectRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  description?: string;

  /** Optional aliases for matching role names from text */
  @IsOptional()
  @IsArray()
  aliases?: string[];

  /** Storage key for role portrait (playing card). Pass null to clear. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  avatarKey?: string | null;
}
