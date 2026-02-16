import { IsIn, IsOptional, IsString } from 'class-validator';

export class RehearsalAttendanceDto {
  @IsString()
  telegramId!: string;

  @IsIn(['present', 'absent', 'late', 'unknown'])
  status!: 'present' | 'absent' | 'late' | 'unknown';

  @IsOptional()
  @IsString()
  userName?: string;

  /** Например "19:30" или "приду к 20:00" */
  @IsOptional()
  @IsString()
  lateTime?: string;
}
