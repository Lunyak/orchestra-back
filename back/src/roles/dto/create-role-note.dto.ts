import { IsString, MaxLength } from 'class-validator';

export class CreateRoleNoteDto {
  @IsString()
  @MaxLength(20000)
  content!: string;
}

