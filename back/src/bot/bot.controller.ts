import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { BotGuard } from './bot.guard';
import { BotProfilesUpsertDto } from './dto/bot-profiles.dto';
import { RehearsalPlanRequestDto } from './dto/rehearsal-plan.dto';
import { BotService } from './bot.service';
import { CreateRehearsalDto } from '../rehearsals/dto/create-rehearsal.dto';
import { SetParticipantsDto } from '../rehearsals/dto/set-participants.dto';
import { RehearsalsService } from '../rehearsals/rehearsals.service';
import { RehearsalPublishedDto } from './dto/rehearsal-published.dto';
import { RehearsalAttendanceDto } from './dto/rehearsal-attendance.dto';
import { DirectorSessionsService } from '../director-sessions/director-sessions.service';

@UseGuards(BotGuard)
@Controller('bot')
export class BotController {
  constructor(
    private readonly botService: BotService,
    private readonly rehearsals: RehearsalsService,
    private readonly directorSessions: DirectorSessionsService,
  ) {}

  @Post('profiles/upsert')
  upsertProfiles(@Body() body: BotProfilesUpsertDto) {
    return this.botService.upsertProfiles(body);
  }

  /** Получить настройки/переменные для текущей bot integration (по заголовку X-Telegram-Bot-Integration-Id) */
  @Get('integration')
  getIntegration(@Req() req: any) {
    return this.botService.getIntegration(req.botIntegrationId);
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
  createRehearsal(@Req() req: any, @Body() body: CreateRehearsalDto) {
    // createdBy неизвестен, помечаем createdVia=bot
    const via = req?.botIntegrationId
      ? `telegram:${String(req.botIntegrationId)}`
      : 'bot';
    return this.rehearsals.create('bot', body, via);
  }

  /** Обновить состав (кто придёт/не придёт) */
  @Post('rehearsals/:id/participants')
  setRehearsalParticipants(
    @Param('id') id: string,
    @Body() body: SetParticipantsDto,
  ) {
    return this.rehearsals.setParticipants('bot', id, body);
  }

  /** Посчитать, какие сцены собираются для этой репетиции */
  @Post('rehearsals/:id/plan')
  planForRehearsal(@Param('id') id: string) {
    return this.rehearsals.plan('bot', id);
  }

  /** Получить репетицию (для публикации/обновления таблицы явок) */
  @Get('rehearsals/:id')
  getRehearsal(@Param('id') id: string) {
    return this.rehearsals.get('bot', id);
  }

  /** Сохранить информацию о публикации репетиции в Telegram */
  @Post('rehearsals/:id/published')
  markPublished(@Param('id') id: string, @Body() body: RehearsalPublishedDto) {
    return this.rehearsals.markTelegramPublished('bot', id, body);
  }

  /** Обновить явку одного участника по Telegram ID */
  @Post('rehearsals/:id/attendance')
  setAttendance(@Param('id') id: string, @Body() body: RehearsalAttendanceDto) {
    return this.rehearsals.upsertParticipantStatusFromBot(id, body);
  }

  // ---- Director Sessions (multi-project) for bot ----
  @Get('director-sessions/:projectId/:sessionId')
  getDirectorSession(
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.directorSessions.getForBot(projectId, sessionId);
  }

  @Post('director-sessions/:projectId/:sessionId/published')
  markDirectorSessionPublished(
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: RehearsalPublishedDto,
  ) {
    return this.directorSessions.markTelegramPublished(
      projectId,
      sessionId,
      body,
    );
  }

  @Post('director-sessions/:projectId/:sessionId/attendance')
  setDirectorSessionAttendance(
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: RehearsalAttendanceDto,
  ) {
    return this.directorSessions.upsertParticipantStatusFromBot(
      projectId,
      sessionId,
      body,
    );
  }
}
