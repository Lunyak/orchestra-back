import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddTeamRoleAssignmentDto } from './dto/add-team-role-assignment.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { AddTroupeMemberDto } from './dto/add-troupe-member.dto';
import { CreateTeamRoleDto } from './dto/create-team-role.dto';
import { PatchTeamMemberDto } from './dto/patch-team-member.dto';
import { PatchTeamRoleDto } from './dto/patch-team-role.dto';
import { PatchTroupeDto } from './dto/patch-troupe.dto';
import { PatchTroupeMemberDto } from './dto/patch-troupe-member.dto';
import { TroupeService } from './troupe.service';

@UseGuards(JwtAuthGuard)
@Controller('troupe')
export class TroupeController {
  constructor(private readonly troupeService: TroupeService) {}

  @Get()
  getMyTroupe(
    @Req() req: any,
    @Query('month') month?: string,
    @Query('project') project?: string,
  ) {
    return this.troupeService.getMyTroupeWithMembers(
      req.user.userId,
      month,
      project,
    );
  }

  @Patch()
  patchMyTroupe(@Req() req: any, @Body() body: PatchTroupeDto) {
    return this.troupeService.updateMyTroupeTitle(req.user.userId, body?.title);
  }

  @Get('team-roles')
  getTeamRoles(@Req() req: any) {
    return this.troupeService.getTeamRoles(req.user.userId);
  }

  @Post('team-roles')
  createTeamRole(@Req() req: any, @Body() body: CreateTeamRoleDto) {
    return this.troupeService.createTeamRole(req.user.userId, body);
  }

  @Get('team-roles/:roleId')
  getTeamRole(@Req() req: any, @Param('roleId') roleId: string) {
    return this.troupeService.getTeamRole(req.user.userId, roleId);
  }

  @Patch('team-roles/:roleId')
  patchTeamRole(
    @Req() req: any,
    @Param('roleId') roleId: string,
    @Body() body: PatchTeamRoleDto,
  ) {
    return this.troupeService.updateTeamRole(req.user.userId, roleId, body);
  }

  @Delete('team-roles/:roleId')
  removeTeamRole(@Req() req: any, @Param('roleId') roleId: string) {
    return this.troupeService.removeTeamRole(req.user.userId, roleId);
  }

  @Post('team-roles/:roleId/assignments')
  addTeamRoleAssignment(
    @Req() req: any,
    @Param('roleId') roleId: string,
    @Body() body: AddTeamRoleAssignmentDto,
  ) {
    return this.troupeService.addTeamRoleAssignment(
      req.user.userId,
      roleId,
      body?.email,
    );
  }

  @Delete('team-roles/:roleId/assignments/:assignmentId')
  removeTeamRoleAssignment(
    @Req() req: any,
    @Param('roleId') roleId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.troupeService.removeTeamRoleAssignment(
      req.user.userId,
      roleId,
      assignmentId,
    );
  }

  @Post('members')
  addMember(
    @Req() req: any,
    @Body() body: AddTroupeMemberDto,
    @Query('project') project?: string,
  ) {
    return this.troupeService.addMember(req.user.userId, body?.email, project);
  }

  @Post('team-members')
  addTeamMember(@Req() req: any, @Body() body: AddTeamMemberDto) {
    return this.troupeService.addTeamMember(
      req.user.userId,
      body?.email,
      body?.roles,
    );
  }

  @Patch('members/:memberId')
  patchMember(
    @Req() req: any,
    @Param('memberId') memberId: string,
    @Body() body: PatchTroupeMemberDto,
    @Query('project') project?: string,
  ) {
    return this.troupeService.updateTroupeMemberKind(
      req.user.userId,
      memberId,
      body?.kind,
      project,
    );
  }

  @Patch('team-members/:memberId')
  patchTeamMember(
    @Req() req: any,
    @Param('memberId') memberId: string,
    @Body() body: PatchTeamMemberDto,
  ) {
    return this.troupeService.updateTeamMember(
      req.user.userId,
      memberId,
      body?.roles,
    );
  }

  @Delete('team-members/:memberId')
  removeTeamMember(@Req() req: any, @Param('memberId') memberId: string) {
    return this.troupeService.removeTeamMember(req.user.userId, memberId);
  }

  @Delete('members/:memberId')
  removeMember(
    @Req() req: any,
    @Param('memberId') memberId: string,
    @Query('project') project?: string,
  ) {
    return this.troupeService.removeMember(req.user.userId, memberId, project);
  }
}
