import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TroupeService } from '../troupe/troupe.service';
import { WorkspacesService } from './workspaces.service';

@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly troupe: TroupeService,
  ) {}

  @Get()
  list(@Req() req: any) {
    return this.workspaces.listCreateTargets(req.user.userId);
  }

  @Post('theaters')
  createTheater(@Req() req: any, @Body() body: { title?: string }) {
    return this.workspaces.createTheater(req.user.userId, body?.title);
  }

  @Get('theaters')
  listTheaters(@Req() req: any) {
    return this.workspaces.listTheaters(req.user.userId);
  }

  @Get('theaters/:theaterId/troupe')
  getTheaterHomeTroupe(
    @Req() req: any,
    @Param('theaterId') theaterId: string,
    @Query('month') month?: string,
  ) {
    return this.troupe.getTheaterHomeTroupeWithMembers(
      req.user.userId,
      theaterId,
      month,
    );
  }

  @Get('theaters/:theaterId/rehearsals')
  listTheaterRehearsals(
    @Req() req: any,
    @Param('theaterId') theaterId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.workspaces.listTheaterRehearsals(
      req.user.userId,
      theaterId,
      from,
      to,
    );
  }

  @Post('theaters/:theaterId/premises')
  createTheaterPremise(
    @Req() req: any,
    @Param('theaterId') theaterId: string,
    @Body() body: { name?: string; address?: string; capacity?: number },
  ) {
    return this.workspaces.createTheaterPremise(
      req.user.userId,
      theaterId,
      body,
    );
  }

  @Post('theaters/:theaterId/troupes')
  createTheaterTroupe(
    @Req() req: any,
    @Param('theaterId') theaterId: string,
    @Body() body: { title?: string },
  ) {
    return this.workspaces.createTroupe(
      req.user.userId,
      theaterId,
      body?.title,
    );
  }

  @Post('theaters/:theaterId/troupes/:troupeId')
  linkTroupe(
    @Req() req: any,
    @Param('theaterId') theaterId: string,
    @Param('troupeId') troupeId: string,
    @Body() body: { participationType?: string },
  ) {
    return this.workspaces.linkTroupe(
      req.user.userId,
      theaterId,
      troupeId,
      body?.participationType,
    );
  }

  @Post('troupes')
  createTroupe(
    @Req() req: any,
    @Body() body: { title?: string; theaterId?: string },
  ) {
    return this.workspaces.createTroupe(
      req.user.userId,
      body?.theaterId,
      body?.title,
    );
  }

  @Get('troupes')
  listTroupes(@Req() req: any) {
    return this.workspaces.listTroupes(req.user.userId);
  }
}
