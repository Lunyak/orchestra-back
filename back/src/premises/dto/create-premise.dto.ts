import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PremiseKind } from '@prisma/client';

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
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDueDay?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
