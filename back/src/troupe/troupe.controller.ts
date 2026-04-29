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
import { AddTroupeMemberDto } from './dto/add-troupe-member.dto';
import { PatchTroupeDto } from './dto/patch-troupe.dto';
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

  @Post('members')
  addMember(
    @Req() req: any,
    @Body() body: AddTroupeMemberDto,
    @Query('project') project?: string,
  ) {
    return this.troupeService.addMember(req.user.userId, body?.email, project);
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
