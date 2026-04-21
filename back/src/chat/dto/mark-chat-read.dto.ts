import { IsOptional, IsString } from 'class-validator';

export class MarkChatReadDto {
  @IsOptional()
  @IsString()
  lastSeenMessageId?: string;
}
