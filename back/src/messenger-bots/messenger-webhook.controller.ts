import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { MessengerBotsService } from './messenger-bots.service';

@Controller('messenger')
export class MessengerWebhookController {
  constructor(private readonly messengers: MessengerBotsService) {}

  @Post('max/webhook/:channelId')
  async maxWebhook(
    @Param('channelId') channelId: string,
    @Headers('x-max-bot-api-secret') secret: string | undefined,
    @Body() body: any,
  ) {
    return this.messengers.handleMaxWebhook(channelId, secret, body);
  }

  @Post('vk/webhook/:channelId')
  async vkWebhook(
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const result = await this.messengers.handleVkWebhook(channelId, body);
    res.status(200).type('text/plain').send(String(result));
  }
}
