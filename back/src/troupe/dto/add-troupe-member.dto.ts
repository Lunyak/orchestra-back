import { IsEmail, MaxLength } from 'class-validator';

export class AddTroupeMemberDto {
  @IsEmail()
  @MaxLength(120)
  email!: string;
}
