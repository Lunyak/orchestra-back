import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePremiseRentalAgreementDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  landlordName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  landlordDetails?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tenantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  tenantDetails?: string;
}
