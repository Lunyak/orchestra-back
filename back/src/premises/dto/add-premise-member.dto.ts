import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { PremiseMemberRole } from '@prisma/client';

export class AddPremiseMemberDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(PremiseMemberRole)
  role?: PremiseMemberRole;

  @IsOptional()
  @IsBoolean()
  canBook?: boolean;
}
