import { PremiseRentalPaymentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdatePremiseRentalPaymentDto {
  @IsEnum(PremiseRentalPaymentStatus)
  status: PremiseRentalPaymentStatus;
}
