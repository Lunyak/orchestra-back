import { IsInt, Max, Min } from 'class-validator';

export class PremiseAvailabilityDayDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsInt()
  @Min(0)
  @Max(1439)
  startsAtMin: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  endsAtMin: number;
}
