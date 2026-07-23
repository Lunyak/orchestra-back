import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SetCollectionParticipantDto {
  @IsEmail()
  email!: string;

  @IsString()
  tariffId!: string;
}

export class SetCollectionParticipantsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SetCollectionParticipantDto)
  participants!: SetCollectionParticipantDto[];
}
