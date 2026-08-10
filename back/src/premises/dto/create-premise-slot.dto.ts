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
import { PremiseSlotPaymentStatus, PremiseSlotStatus } from '@prisma/client';

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
  @IsInt()
  @Min(0)
  rentalAmountRub?: number;

  @IsOptional()
  @IsEnum(PremiseSlotPaymentStatus)
  paymentStatus?: PremiseSlotPaymentStatus;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsEnum(PremiseSlotStatus)
  status?: PremiseSlotStatus;
}
