import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Inject,
  Optional,
  Param,
  Post,
  forwardRef,
} from '@nestjs/common';
import { TelegramBotsService } from './telegram-bots.service';
import { MessengerBridgeService } from '../messenger-bots/messenger-bridge.service';

@Controller('telegram')
export class TelegramWebhookController {
  constructor(
    private readonly telegramBots: TelegramBotsService,
    @Optional()
    @Inject(forwardRef(() => MessengerBridgeService))
    private readonly bridge?: MessengerBridgeService,
  ) {}

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

    const message = update?.message ?? update?.edited_message;
    if (message && this.bridge) {
      const text = String(message?.text ?? message?.caption ?? '').trim();
      const messageId = String(message?.message_id ?? '');
      const chatId = String(message?.chat?.id ?? '');
      const from = message?.from;
      const fromBot = Boolean(from?.is_bot);
      const authorName =
        String(from?.username ?? from?.first_name ?? '').trim() || 'Telegram';

      if (text && messageId && chatId) {
        await this.bridge.handleInbound({
          platform: 'telegram',
          sourceRef: botId,
          messageId,
          chatId,
          text,
          authorName,
          fromBot,
        });
      }
    }

    return { ok: true };
  }
}
