import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpsertProjectRoleDto } from './dto/upsert-role.dto';
import { SetRoleAssignmentsDto } from './dto/set-role-assignments.dto';
import { CreateRoleNoteDto } from './dto/create-role-note.dto';
import { RolesService } from './roles.service';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get(':slug/roles')
  list(@Req() req: any, @Param('slug') slug: string) {
    return this.roles.listRoles(req.user.userId, slug);
  }

  @Post(':slug/roles')
  create(
    @Req() req: any,
    @Param('slug') slug: string,
    @Body() body: UpsertProjectRoleDto,
  ) {
    return this.roles.upsertRole(req.user.userId, slug, null, body as any);
  }

  @Put(':slug/roles/:roleId')
  update(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('roleId') roleId: string,
    @Body() body: UpsertProjectRoleDto,
  ) {
    return this.roles.upsertRole(req.user.userId, slug, roleId, body as any);
  }

  @Put(':slug/roles/:roleId/assignments')
  setAssignments(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('roleId') roleId: string,
    @Body() body: SetRoleAssignmentsDto,
  ) {
    return this.roles.setRoleAssignments(
      req.user.userId,
      slug,
      roleId,
      body as any,
    );
  }

  @Delete(':slug/roles/:roleId')
  remove(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('roleId') roleId: string,
  ) {
    return this.roles.deleteRole(req.user.userId, slug, roleId);
  }

  @Get(':slug/roles/:roleId/notes')
  listNotes(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('roleId') roleId: string,
  ) {
    return this.roles.listRoleNotes(req.user.userId, slug, roleId);
  }

  @Post(':slug/roles/:roleId/notes')
  addNote(
    @Req() req: any,
    @Param('slug') slug: string,
    @Param('roleId') roleId: string,
    @Body() body: CreateRoleNoteDto,
  ) {
    return this.roles.addRoleNote(req.user.userId, slug, roleId, body as any);
  }
}
