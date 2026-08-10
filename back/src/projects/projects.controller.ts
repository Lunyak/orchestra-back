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

  @Get('invites/by-id/:inviteId')
  previewAddressedInvite(
    @Req() req: any,
    @Param('inviteId') inviteId: string,
  ) {
    return this.projectsService.previewAddressedInvite(
      req.user.userId,
      req.user.email,
      inviteId,
    );
  }

  @Post('invites/by-id/:inviteId/accept')
  acceptAddressedInvite(@Req() req: any, @Param('inviteId') inviteId: string) {
    return this.projectsService.acceptAddressedInvite(
      req.user.userId,
      req.user.email,
      inviteId,
    );
  }

  @Post('invites/by-id/:inviteId/decline')
  declineAddressedInvite(
    @Req() req: any,
    @Param('inviteId') inviteId: string,
  ) {
    return this.projectsService.declineAddressedInvite(
      req.user.userId,
      req.user.email,
      inviteId,
    );
  }

  @Get('theater-invites/:token')
  previewTheaterInvite(@Req() req: any, @Param('token') token: string) {
    return this.projectsService.previewTheaterInvite(req.user.userId, token);
  }

  @Post('theater-invites/:token/accept')
  acceptTheaterInvite(
    @Req() req: any,
    @Param('token') token: string,
    @Body() body: { theaterId: string },
  ) {
    return this.projectsService.acceptTheaterInvite(
      req.user.userId,
      token,
      body,
    );
  }

  @Get(':slug/members')
  getMembers(@Req() req: any, @Param('slug') slug: string) {
    return this.projectsService.getProjectMembers(req.user.userId, slug);
  }

  @Get(':slug/links')
  getLinks(@Req() req: any, @Param('slug') slug: string) {
    return this.projectsService.getProjectLinks(req.user.userId, slug);
  }

  @Get(':slug/production-team')
  getProductionTeam(@Req() req: any, @Param('slug') slug: string) {
    return this.projectsService.getProductionTeam(req.user.userId, slug);
  }

  @Get(':slug/team-roles')
  getTeamRoles(@Req() req: any, @Param('slug') slug: string) {
    return this.projectsService.getProjectTeamRoles(req.user.userId, slug);
  }

  @Post(':slug/team-roles')
  createTeamRole(
    @Req() req: any,
    @Param('slug') slug: string,
    @Body() body: unknown,
  ) {
    return this.projectsService.createProjectTeamRole(
      req.user.userId,
      slug,
      body,
    );
  }

  @Get(':slug/team-roles/:roleId')
  getTeamRole(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('roleId') roleId: string,
  ) {
    return this.projectsService.getProjectTeamRole(
      req.user.userId,
      slug,
      roleId,
    );
  }

  @Patch(':slug/team-roles/:roleId')
  patchTeamRole(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('roleId') roleId: string,
    @Body() body: unknown,
  ) {
    return this.projectsService.updateProjectTeamRole(
      req.user.userId,
      slug,
      roleId,
      body,
    );
  }

  @Delete(':slug/team-roles/:roleId')
  removeTeamRole(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('roleId') roleId: string,
  ) {
    return this.projectsService.removeProjectTeamRole(
      req.user.userId,
      slug,
      roleId,
    );
  }

  @Post(':slug/team-roles/:roleId/assignments')
  addTeamRoleAssignment(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('roleId') roleId: string,
    @Body() body: { email?: string },
  ) {
    return this.projectsService.addProjectTeamRoleAssignment(
      req.user.userId,
      slug,
      roleId,
      body?.email,
    );
  }

  @Delete(':slug/team-roles/:roleId/assignments/:assignmentId')
  removeTeamRoleAssignment(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('roleId') roleId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.projectsService.removeProjectTeamRoleAssignment(
      req.user.userId,
      slug,
      roleId,
      assignmentId,
    );
  }

  @Get(':slug/access')
  getAccess(@Req() req: any, @Param('slug') slug: string) {
    return this.projectsService.getProjectAccess(req.user.userId, slug);
  }

  @Post(':slug/transfer-ownership')
  transferOwnership(
    @Req() req: any,
    @Param('slug') slug: string,
    @Body() body: { userId: string },
  ) {
    return this.projectsService.transferOwnership(req.user.userId, slug, body);
  }

  @Get(':slug/theater-invites')
  listTheaterInvites(@Req() req: any, @Param('slug') slug: string) {
    return this.projectsService.listTheaterInvites(req.user.userId, slug);
  }

  @Post(':slug/theater-invites')
  createTheaterInvite(@Req() req: any, @Param('slug') slug: string) {
    return this.projectsService.createTheaterInvite(req.user.userId, slug);
  }

  @Post(':slug/theater-invites/:inviteId/revoke')
  revokeTheaterInvite(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.projectsService.revokeTheaterInvite(
      req.user.userId,
      slug,
      inviteId,
    );
  }

  @Post(':slug/theaters/:theaterId')
  linkTheater(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('theaterId') theaterId: string,
    @Body() body: { participationType?: string },
  ) {
    return this.projectsService.linkTheater(
      req.user.userId,
      slug,
      theaterId,
      body?.participationType,
    );
  }

  @Delete(':slug/theaters/:theaterId')
  unlinkTheater(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('theaterId') theaterId: string,
  ) {
    return this.projectsService.unlinkTheater(
      req.user.userId,
      slug,
      theaterId,
    );
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
    return this.projectsService.setTelegramBotPreference(
      req.user.userId,
      slug,
      body,
    );
  }

  @Post()
  createProject(@Req() req: any, @Body() body: any) {
    return this.projectsService.createProject(req.user.userId, body);
  }

  @Patch(':slug')
  updateProject(
    @Req() req: any,
    @Param('slug') slug: string,
    @Body() body: any,
  ) {
    return this.projectsService.updateProject(req.user.userId, slug, body);
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

  /** Очистка неиспользуемых картинок проекта (MinIO): удаляет объекты projectId/image/*, которых нет в markdown шагов. */
  @Post(':slug/images/cleanup')
  cleanupImages(@Req() req: any, @Param('slug') slug: string) {
    return this.projectsService.cleanupProjectImages(req.user.userId, slug);
  }
}
