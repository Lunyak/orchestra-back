import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCollectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsIn(['draft', 'active', 'closed'])
  status?: 'draft' | 'active' | 'closed';

  @IsOptional()
  @IsString()
  dueAt?: string | null;

  @IsOptional()
  @IsString()
  premiseId?: string | null;
}
