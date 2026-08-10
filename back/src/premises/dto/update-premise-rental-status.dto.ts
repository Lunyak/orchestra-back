import { IsIn } from 'class-validator';

export class UpdatePremiseRentalStatusDto {
  @IsIn(['active', 'cancelled'])
  status: 'active' | 'cancelled';
}
