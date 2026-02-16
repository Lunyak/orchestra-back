import { IsOptional, IsString } from 'class-validator';

export class RehearsalPublishedDto {
  @IsString()
  chatId!: string;

  @IsString()
  messageId!: string;

  @IsOptional()
  @IsString()
  threadId?: string;
}

