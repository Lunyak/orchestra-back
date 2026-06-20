import { IsArray, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddTeamMemberDto {
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}
