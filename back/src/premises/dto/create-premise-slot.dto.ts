import {
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PremiseSlotStatus } from '@prisma/client';

export class CreatePremiseSlotDto {
  @IsISO8601()
  startsAt: string;

  @IsInt()
  @Min(1)
  durationMin: number;

  @IsString()
  @MaxLength(140)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rentalNotes?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @IsOptional()
  @IsEnum(PremiseSlotStatus)
  status?: PremiseSlotStatus;
}
