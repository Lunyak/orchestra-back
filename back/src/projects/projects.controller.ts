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
import { ProjectsService } from './projects.service';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  getMyProjects(@Req() req: any) {
    return this.projectsService.getUserProjects(req.user.userId);
  }

  @Get(':slug/members')
  getMembers(@Req() req: any, @Param('slug') slug: string) {
    return this.projectsService.getProjectMembers(req.user.userId, slug);
  }

  @Get(':slug')
  getProject(@Req() req: any, @Param('slug') slug: string) {
    return this.projectsService.getProjectBySlug(req.user.userId, slug);
  }

  @Get(':slug/telegram-bot')
  getTelegramBotPreference(@Req() req: any, @Param('slug') slug: string) {
    return this.projectsService.getTelegramBotPreference(req.user.userId, slug);
  }

  @Put(':slug/telegram-bot')
  setTelegramBotPreference(
    @Req() req: any,
    @Param('slug') slug: string,
    @Body() body: { botIntegrationId: string | null },
  ) {
    return this.projectsService.setTelegramBotPreference(req.user.userId, slug, body);
  }

  @Post()
  createProject(@Req() req: any, @Body() body: any) {
    return this.projectsService.createProject(req.user.userId, body);
  }

  @Post(':slug/members')
  addMember(@Req() req: any, @Param('slug') slug: string, @Body() body: any) {
    return this.projectsService.addMember(req.user.userId, slug, body);
  }

  @Post(':slug/invite')
  inviteByEmail(
    @Req() req: any,
    @Param('slug') slug: string,
    @Body() body: { email: string; role?: string },
  ) {
    return this.projectsService.inviteByEmail(req.user.userId, slug, body);
  }

  @Patch(':slug/members/:memberId')
  updateMemberRole(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('memberId') memberId: string,
    @Body() body: { role: string },
  ) {
    return this.projectsService.updateMemberRole(
      req.user.userId,
      slug,
      memberId,
      body,
    );
  }

  @Delete(':slug/members/:memberId')
  removeMember(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('memberId') memberId: string,
  ) {
    return this.projectsService.removeMember(req.user.userId, slug, memberId);
  }
}
