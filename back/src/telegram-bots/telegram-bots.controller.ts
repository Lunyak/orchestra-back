import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConnectTelegramBotDto } from './dto/connect-telegram-bot.dto';
import { TelegramBotTestMessageDto } from './dto/test-message.dto';
import { UpdateTelegramBotDto } from './dto/update-telegram-bot.dto';
import { UpsertBotVariableDto } from './dto/upsert-variable.dto';
import { TelegramBotsService } from './telegram-bots.service';

@UseGuards(JwtAuthGuard)
@Controller('telegram-bots')
export class TelegramBotsController {
  constructor(private readonly telegramBots: TelegramBotsService) {}

  @Get()
  list(@Req() req: any) {
    return this.telegramBots.listMyBots(req.user.userId);
  }

  @Post('connect')
  connect(@Req() req: any, @Body() body: ConnectTelegramBotDto) {
    return this.telegramBots.connect(req.user.userId, body);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateTelegramBotDto,
  ) {
    return this.telegramBots.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.telegramBots.remove(req.user.userId, id);
  }

  // ---- variables ----

  @Get(':id/variables')
  listVars(@Req() req: any, @Param('id') id: string) {
    return this.telegramBots.listVariables(req.user.userId, id);
  }

  @Put(':id/variables/:key')
  upsertVar(
    @Req() req: any,
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() body: UpsertBotVariableDto,
  ) {
    return this.telegramBots.upsertVariable(req.user.userId, id, key, body);
  }

  @Delete(':id/variables/:key')
  deleteVar(
    @Req() req: any,
    @Param('id') id: string,
    @Param('key') key: string,
  ) {
    return this.telegramBots.deleteVariable(req.user.userId, id, key);
  }

  // ---- test ----

  @Post(':id/test-message')
  testMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: TelegramBotTestMessageDto,
  ) {
    return this.telegramBots.sendTestMessage(req.user.userId, id, body);
  }
}
