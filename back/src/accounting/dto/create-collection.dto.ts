import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateCollectionTariffDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsInt()
  @Min(1)
  amountRub!: number;
}

export class CreateCollectionParticipantDto {
  @IsEmail()
  email!: string;

  @IsInt()
  @Min(0)
  tariffIndex!: number;
}

export class CreateCollectionDto {
  @IsOptional()
  @IsString()
  troupeId?: string;

  @IsOptional()
  @IsString()
  studioId?: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  premiseId?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateCollectionTariffDto)
  tariffs!: CreateCollectionTariffDto[];

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateCollectionParticipantDto)
  participants!: CreateCollectionParticipantDto[];
}
