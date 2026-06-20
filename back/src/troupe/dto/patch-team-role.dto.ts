import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class PatchTeamRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
