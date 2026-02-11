import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PresentPersonDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsArray()
  @IsString({ each: true })
  roles: string[];
}

export class RehearsalPlanRequestDto {
  @IsString()
  projectSlug: string;

  /** Если удобнее — можно прислать просто набор ролей, которые точно присутствуют */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  presentRoles?: string[];

  /** Или прислать список людей с ролями (у одного человека может быть несколько ролей) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PresentPersonDto)
  presentPeople?: PresentPersonDto[];
}

