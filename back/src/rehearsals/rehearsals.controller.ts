import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Put,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRehearsalDto } from './dto/create-rehearsal.dto';
import { SetParticipantsDto } from './dto/set-participants.dto';
import { UpdateRehearsalDto } from './dto/update-rehearsal.dto';
import { UpsertMyRehearsalCommentDto } from './dto/upsert-my-rehearsal-comment.dto';
import { RehearsalsService } from './rehearsals.service';

@UseGuards(JwtAuthGuard)
@Controller('rehearsals')
export class RehearsalsController {
  constructor(private readonly rehearsals: RehearsalsService) {}

  @Get()
  list(
    @Req() req: any,
    @Query('projectSlug') projectSlug: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.rehearsals.list(req.user.userId, projectSlug, from, to);
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateRehearsalDto) {
    return this.rehearsals.create(req.user.userId, body, 'web');
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.rehearsals.get(req.user.userId, id);
  }

  @Get(':id/my-comment')
  getMyComment(@Req() req: any, @Param('id') id: string) {
    return this.rehearsals.getMyComment(req.user.userId, id);
  }

  @Put(':id/my-comment')
  upsertMyComment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpsertMyRehearsalCommentDto,
  ) {
    return this.rehearsals.upsertMyComment(
      req.user.userId,
      req.user.email,
      id,
      body,
    );
  }

  @Get(':id/scenes')
  scenes(@Req() req: any, @Param('id') id: string) {
    return this.rehearsals.getScenesForRehearsal(req.user.userId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateRehearsalDto,
  ) {
    return this.rehearsals.update(req.user.userId, id, body);
  }

  @Post(':id/participants')
  setParticipants(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: SetParticipantsDto,
  ) {
    return this.rehearsals.setParticipants(req.user.userId, id, body);
  }

  @Post(':id/my-attendance')
  setMyAttendance(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status?: 'present' | 'absent' },
  ) {
    return this.rehearsals.setMyAttendance(
      req.user.userId,
      req.user.email,
      id,
      body.status,
    );
  }

  @Post(':id/plan')
  plan(@Req() req: any, @Param('id') id: string) {
    return this.rehearsals.plan(req.user.userId, id);
  }

  /** Публикация репетиции в чат (через отдельный bot-сервис) */
  @Post(':id/publish')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.rehearsals.publish(req.user.userId, id);
  }
}
