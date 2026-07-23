import { IsEmail, IsIn } from 'class-validator';

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsIn(['teacher', 'student'])
  role!: 'teacher' | 'student';
}
