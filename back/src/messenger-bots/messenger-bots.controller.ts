import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessengerBotsService } from './messenger-bots.service';
import { MessengerBridgeService } from './messenger-bridge.service';

@UseGuards(JwtAuthGuard)
@Controller('messenger-bots')
export class MessengerBotsController {
  constructor(
    private readonly messengers: MessengerBotsService,
    private readonly bridge: MessengerBridgeService,
  ) {}

  @Get()
  list(@Req() req: any) {
    return this.messengers.listMyChannels(req.user.userId);
  }

  @Post('connect')
  connect(
    @Req() req: any,
    @Body()
    body: {
      platform: 'max' | 'vk';
      token: string;
      title?: string;
      chatId?: string;
      vkGroupId?: string;
    },
  ) {
    return this.messengers.connect(req.user.userId, body);
  }

  @Get('bridges')
  listBridges(@Req() req: any) {
    return this.bridge.listBridges(req.user.userId);
  }

  @Post('bridges')
  createBridge(
    @Req() req: any,
    @Body()
    body: {
      title?: string;
      primary: {
        platform: 'telegram' | 'max' | 'vk';
        telegramBotId?: string;
        channelId?: string;
        chatId?: string;
      };
      mirrors?: Array<{
        platform: 'telegram' | 'max' | 'vk';
        telegramBotId?: string;
        channelId?: string;
        chatId?: string;
      }>;
    },
  ) {
    return this.bridge.createBridge(req.user.userId, body);
  }

  @Patch('bridges/:id')
  updateBridge(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { title?: string | null; enabled?: boolean },
  ) {
    return this.bridge.updateBridge(req.user.userId, id, body);
  }

  @Delete('bridges/:id')
  deleteBridge(@Req() req: any, @Param('id') id: string) {
    return this.bridge.deleteBridge(req.user.userId, id);
  }

  @Post('publish')
  publish(
    @Req() req: any,
    @Body()
    body: {
      text: string;
      channelIds?: string[];
      telegramBotIds?: string[];
    },
  ) {
    return this.bridge.publishText(req.user.userId, body);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string | null;
      status?: string;
      chatId?: string | null;
      vkConfirmation?: string | null;
    },
  ) {
    return this.messengers.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.messengers.remove(req.user.userId, id);
  }

  @Post(':id/test-message')
  testMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { chatId?: string; text: string },
  ) {
    return this.messengers.sendTestMessage(req.user.userId, id, body);
  }
}
