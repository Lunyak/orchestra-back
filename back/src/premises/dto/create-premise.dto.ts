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

export class CreatePremiseDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  theaterId?: string;

  @IsOptional()
  @IsString()
  studioId?: string;

  @IsOptional()
  @IsEnum(PremiseKind)
  kind?: PremiseKind;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => PremiseAvailabilityDayDto)
  weeklyAvailability?: PremiseAvailabilityDayDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
