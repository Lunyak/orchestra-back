import { IsString, MaxLength, MinLength } from 'class-validator';

export class TelegramBotTestMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  chatId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;
}
