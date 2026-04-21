import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
  getMyTroupe(@Req() req: any) {
    return this.troupeService.getMyTroupeWithMembers(req.user.userId);
  }

  @Patch()
  patchMyTroupe(@Req() req: any, @Body() body: PatchTroupeDto) {
    return this.troupeService.updateMyTroupeTitle(req.user.userId, body?.title);
  }

  @Post('members')
  addMember(@Req() req: any, @Body() body: AddTroupeMemberDto) {
    return this.troupeService.addMember(req.user.userId, body?.email);
  }

  @Delete('members/:memberId')
  removeMember(@Req() req: any, @Param('memberId') memberId: string) {
    return this.troupeService.removeMember(req.user.userId, memberId);
  }
}
