import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DirectorSessionsService } from './director-sessions.service';

@UseGuards(JwtAuthGuard)
@Controller('director-sessions')
export class DirectorSessionsController {
  constructor(private readonly sessions: DirectorSessionsService) {}

  /** Публикация сборной сессии в Telegram (через bot-сервис) */
  @Post(':id/publish')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.sessions.publish(req.user.userId, id);
  }
}

