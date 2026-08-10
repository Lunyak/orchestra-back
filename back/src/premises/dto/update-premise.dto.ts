import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PremiseKind } from '@prisma/client';
import { PremiseAvailabilityDayDto } from './premise-availability-day.dto';

export class UpdatePremiseDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(PremiseKind)
  kind?: PremiseKind;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => PremiseAvailabilityDayDto)
  weeklyAvailability?: PremiseAvailabilityDayDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
