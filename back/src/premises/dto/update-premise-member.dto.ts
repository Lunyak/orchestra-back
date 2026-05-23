import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PremiseMemberRole } from '@prisma/client';

export class UpdatePremiseMemberDto {
  @IsOptional()
  @IsEnum(PremiseMemberRole)
  role?: PremiseMemberRole;

  @IsOptional()
  @IsBoolean()
  canBook?: boolean;
}
