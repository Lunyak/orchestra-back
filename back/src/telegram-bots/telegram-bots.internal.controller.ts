import { Controller, Get, UseGuards } from '@nestjs/common';
import { TelegramBotsService } from './telegram-bots.service';
import { RunnerSecretGuard } from './runner-secret.guard';

@UseGuards(RunnerSecretGuard)
@Controller('internal/telegram-bots')
export class TelegramBotsInternalController {
  constructor(private readonly telegramBots: TelegramBotsService) {}

  /**
   * For bot-runner service: list all connected integrations with decrypted tokens.
   * Keep this endpoint internal and protected by runner secret.
   */
  @Get('integrations')
  listIntegrationsForRunner() {
    return this.telegramBots.listConnectedIntegrationsForRunner();
  }
}
