import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DirectorSessionsService } from './director-sessions.service';
import { UpsertDirectorSessionsDto } from './dto/director-sessions.dto';
import { UpsertMyDirectorSessionCommentDto } from './dto/upsert-my-director-session-comment.dto';

@UseGuards(JwtAuthGuard)
@Controller('director-sessions')
export class DirectorSessionsController {
  constructor(private readonly sessions: DirectorSessionsService) {}

  /** Список режиссёрских сессий текущего пользователя */
  @Get()
  list(@Req() req: any) {
    return this.sessions.list(req.user.userId);
  }

  /**
   * Опубликованные сессии других пользователей, где email текущего пользователя
   * в plannedEmails или participants (для календаря занятости / вызовов).
   * Должен быть выше :id, иначе id = "invitations".
   */
  @Get('invitations')
  listInvitations(
    @Req() req: any,
    @Query('fromIso') fromIso?: string,
    @Query('toIso') toIso?: string,
  ) {
    return this.sessions.listPublishedInvitationsForEmail(
      req.user.userId,
      req.user.email,
      fromIso,
      toIso,
    );
  }

  /** Полностью заменить список режиссёрских сессий пользователя */
  @Put()
  replaceAll(@Req() req: any, @Body() body: UpsertDirectorSessionsDto) {
    return this.sessions.replaceAll(req.user.userId, body);
  }

  /** Публикация сборной сессии в Telegram (через bot-сервис) */
  @Post(':id/publish')
  publish(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { comment?: string } | undefined,
  ) {
    return this.sessions.publish(req.user.userId, id, body);
  }

  /** Получить одну сессию по id (payload) */
  @Get(':id')
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.sessions.get(req.user.userId, req.user.email, id);
  }

  /** Участник подтверждает явку на сессию (participants[].status). */
  @Post(':id/confirm-attendance')
  confirmMyAttendance(@Req() req: any, @Param('id') id: string) {
    return this.sessions.confirmMyAttendance(
      req.user.userId,
      req.user.email,
      id,
    );
  }

  /** Участник отклоняет явку («не приду», participants[].status = absent). */
  @Post(':id/decline-attendance')
  declineMyAttendance(@Req() req: any, @Param('id') id: string) {
    return this.sessions.declineMyAttendance(
      req.user.userId,
      req.user.email,
      id,
    );
  }

  /** Напомнить актёрам без отметки занятости заполнить профиль. */
  @Post(':id/remind-missing-availability')
  remindMissingAvailability(@Req() req: any, @Param('id') id: string) {
    return this.sessions.remindMissingAvailability(req.user.userId, id);
  }

  @Get(':id/my-comment')
  getMyComment(@Req() req: any, @Param('id') id: string) {
    return this.sessions.getMyComment(req.user.userId, id);
  }

  @Put(':id/my-comment')
  upsertMyComment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpsertMyDirectorSessionCommentDto,
  ) {
    return this.sessions.upsertMyComment(req.user.userId, req.user.email, id, body);
  }
}
