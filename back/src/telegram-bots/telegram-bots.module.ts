import { Module, forwardRef } from '@nestjs/common';
import { TelegramBotsController } from './telegram-bots.controller';
import { TelegramBotsService } from './telegram-bots.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramBotsInternalController } from './telegram-bots.internal.controller';
import { MessengerBotsModule } from '../messenger-bots/messenger-bots.module';

@Module({
  imports: [forwardRef(() => MessengerBotsModule)],
  controllers: [
    TelegramBotsController,
    TelegramWebhookController,
    TelegramBotsInternalController,
  ],
  providers: [TelegramBotsService],
  exports: [TelegramBotsService],
})
export class TelegramBotsModule {}
