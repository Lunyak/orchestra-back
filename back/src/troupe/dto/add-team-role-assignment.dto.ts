import { IsEmail, MaxLength } from 'class-validator';

export class AddTeamRoleAssignmentDto {
  @IsEmail()
  @MaxLength(120)
  email!: string;
}
