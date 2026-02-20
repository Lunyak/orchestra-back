import { Body, Controller, ForbiddenException, Headers, Param, Post } from '@nestjs/common';
import { TelegramBotsService } from './telegram-bots.service';

@Controller('telegram')
export class TelegramWebhookController {
  constructor(private readonly telegramBots: TelegramBotsService) {}

  @Post('webhook/:botId')
  async webhook(
    @Param('botId') botId: string,
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: any,
  ) {
    const ok = await this.telegramBots.validateWebhookSecret(botId, secret);
    if (!ok) {
      throw new ForbiddenException();
    }

    // Пока просто подтверждаем приём. Логику обработки апдейтов будем подключать
    // поверх этого endpoint-а (команды/сценарии/и т.д.)
    return { ok: true };
  }
}

