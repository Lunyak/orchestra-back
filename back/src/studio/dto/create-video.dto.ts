import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateVideoDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsUrl()
  @MaxLength(2000)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  assignmentId?: string;
}
