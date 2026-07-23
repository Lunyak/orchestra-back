import { IsEmail, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class CreateInviteDto {
  @IsIn(['teacher', 'student'])
  role!: 'teacher' | 'student';

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInDays?: number;
}
