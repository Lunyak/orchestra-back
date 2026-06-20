import { IsArray, IsOptional, IsString } from 'class-validator';

export class PatchTeamMemberDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}
