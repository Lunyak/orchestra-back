import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

export class RehearsalParticipantInputDto {
  @IsEmail()
  email: string;

  @IsIn(['unknown', 'present', 'absent'])
  status: 'unknown' | 'present' | 'absent';

  @IsOptional()
  roles?: any;

  @IsOptional()
  @IsString()
  displayName?: string;
}

export class SetParticipantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RehearsalParticipantInputDto)
  participants: RehearsalParticipantInputDto[];
}

