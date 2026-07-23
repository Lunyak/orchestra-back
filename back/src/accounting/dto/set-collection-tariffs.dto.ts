import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SetCollectionTariffDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsInt()
  @Min(1)
  amountRub!: number;
}

export class SetCollectionTariffsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SetCollectionTariffDto)
  tariffs!: SetCollectionTariffDto[];
}
