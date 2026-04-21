import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PostChatMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientMessageId?: string;
}
