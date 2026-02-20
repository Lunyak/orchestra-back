import { Module } from '@nestjs/common';
import { TelegramBotsController } from './telegram-bots.controller';
import { TelegramBotsService } from './telegram-bots.service';
import { TelegramWebhookController } from './telegram-webhook.controller';

@Module({
  controllers: [TelegramBotsController, TelegramWebhookController],
  providers: [TelegramBotsService],
  exports: [TelegramBotsService],
})
export class TelegramBotsModule {}

