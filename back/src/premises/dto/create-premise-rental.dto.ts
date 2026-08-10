import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PremiseRecurrenceType, PremiseUsageType } from '@prisma/client';

export class PremiseRentalScheduleDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsInt()
  @Min(0)
  @Max(1439)
  startsAtMin: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  durationMin: number;
}

export class CreatePremiseRentalDto {
  @IsEnum(PremiseUsageType)
  usageType: PremiseUsageType;

  @IsEnum(PremiseRecurrenceType)
  recurrenceType: PremiseRecurrenceType;

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
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsISO8601()
  startsOn: string;

  @IsOptional()
  @IsISO8601()
  endsOn?: string;

  @IsOptional()
  @IsBoolean()
  indefinite?: boolean;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(-840)
  @Max(840)
  timezoneOffsetMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMin?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => PremiseRentalScheduleDto)
  schedules?: PremiseRentalScheduleDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  amountRub?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyAmountRub?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDueDay?: number;

  @IsOptional()
  @IsBoolean()
  agreementRequested?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  landlordName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  landlordDetails?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tenantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  tenantDetails?: string;
}
