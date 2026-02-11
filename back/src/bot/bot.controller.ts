import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { BotGuard } from './bot.guard';
import { BotProfilesUpsertDto } from './dto/bot-profiles.dto';
import { RehearsalPlanRequestDto } from './dto/rehearsal-plan.dto';
import { BotService } from './bot.service';
import { CreateRehearsalDto } from '../rehearsals/dto/create-rehearsal.dto';
import { SetParticipantsDto } from '../rehearsals/dto/set-participants.dto';
import { RehearsalsService } from '../rehearsals/rehearsals.service';

@UseGuards(BotGuard)
@Controller('bot')
export class BotController {
  constructor(
    private readonly botService: BotService,
    private readonly rehearsals: RehearsalsService,
  ) {}

  @Post('profiles/upsert')
  upsertProfiles(@Body() body: BotProfilesUpsertDto) {
    return this.botService.upsertProfiles(body);
  }

  @Post('profiles/resolve')
  resolveProfiles(@Body() body: { emails: string[] }) {
    return this.botService.resolveProfiles(body?.emails ?? []);
  }

  @Post('rehearsal/plan')
  plan(@Body() body: RehearsalPlanRequestDto) {
    return this.botService.planRehearsal(body);
  }

  /** Создать репетицию из бота (истина в БД Orchestra) */
  @Post('rehearsals')
  createRehearsal(@Body() body: CreateRehearsalDto) {
    // createdBy неизвестен, помечаем createdVia=bot
    return this.rehearsals.create('bot', body, 'bot');
  }

  /** Обновить состав (кто придёт/не придёт) */
  @Post('rehearsals/:id/participants')
  setRehearsalParticipants(@Param('id') id: string, @Body() body: SetParticipantsDto) {
    return this.rehearsals.setParticipants('bot', id, body);
  }

  /** Посчитать, какие сцены собираются для этой репетиции */
  @Post('rehearsals/:id/plan')
  planForRehearsal(@Param('id') id: string) {
    return this.rehearsals.plan('bot', id);
  }
}

