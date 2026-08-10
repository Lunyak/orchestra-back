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

export class UpdatePremiseSlotDto {
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMin?: number;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  purpose?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rentalNotes?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  rentalAmountRub?: number | null;

  @IsOptional()
  @IsEnum(PremiseSlotPaymentStatus)
  paymentStatus?: PremiseSlotPaymentStatus;

  @IsOptional()
  @IsEmail()
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string | null;

  @IsOptional()
  @IsEnum(PremiseSlotStatus)
  status?: PremiseSlotStatus;
}
