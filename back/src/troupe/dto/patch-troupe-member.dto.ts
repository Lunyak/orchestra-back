import { IsIn } from 'class-validator';

export class PatchTroupeMemberDto {
  @IsIn(['regular', 'guest'])
  kind!: 'regular' | 'guest';
}
