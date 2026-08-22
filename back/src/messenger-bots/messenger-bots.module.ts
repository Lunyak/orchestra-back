import { Module } from '@nestjs/common';
import { MessengerBotsController } from './messenger-bots.controller';
import { MessengerWebhookController } from './messenger-webhook.controller';
import { MessengerBotsService } from './messenger-bots.service';
import { MessengerBridgeService } from './messenger-bridge.service';

@Module({
  controllers: [MessengerBotsController, MessengerWebhookController],
  providers: [MessengerBotsService, MessengerBridgeService],
  exports: [MessengerBotsService, MessengerBridgeService],
})
export class MessengerBotsModule {}
