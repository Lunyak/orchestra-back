import { IsIn } from 'class-validator';

export class UpdateMemberDto {
  @IsIn(['teacher', 'student'])
  role!: 'teacher' | 'student';
}
