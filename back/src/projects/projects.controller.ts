import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
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

  @Get(':slug')
  getProject(@Req() req: any, @Param('slug') slug: string) {
    return this.projectsService.getProjectBySlug(req.user.userId, slug);
  }

  @Post()
  createProject(@Req() req: any, @Body() body: any) {
    return this.projectsService.createProject(req.user.userId, body);
  }

  @Post(':slug/members')
  addMember(
    @Req() req: any,
    @Param('slug') slug: string,
    @Body() body: any,
  ) {
    return this.projectsService.addMember(req.user.userId, slug, body);
  }
}

