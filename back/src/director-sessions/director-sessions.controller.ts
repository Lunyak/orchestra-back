import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DirectorSessionsService } from './director-sessions.service';
import { UpsertDirectorSessionsDto } from './dto/director-sessions.dto';

@UseGuards(JwtAuthGuard)
@Controller('director-sessions')
export class DirectorSessionsController {
  constructor(private readonly sessions: DirectorSessionsService) {}

  /** Список режиссёрских сессий текущего пользователя */
  @Get()
  list(@Req() req: any) {
    return this.sessions.list(req.user.userId);
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
}
