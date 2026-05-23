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
import { AddPremiseMemberDto } from './dto/add-premise-member.dto';
import { CreatePremiseDto } from './dto/create-premise.dto';
import { CreatePremiseSlotDto } from './dto/create-premise-slot.dto';
import { UpdatePremiseDto } from './dto/update-premise.dto';
import { UpdatePremiseMemberDto } from './dto/update-premise-member.dto';
import { UpdatePremiseSlotDto } from './dto/update-premise-slot.dto';
import { PremisesService } from './premises.service';

@UseGuards(JwtAuthGuard)
@Controller('premises')
export class PremisesController {
  constructor(private readonly premises: PremisesService) {}

  @Get()
  list(@Req() req: any) {
    return this.premises.listPremises(req.user.userId, req.user.email);
  }

  @Get('my')
  listMy(@Req() req: any) {
    return this.premises.listMyPremises(req.user.userId, req.user.email);
  }

  @Post()
  create(@Req() req: any, @Body() body: CreatePremiseDto) {
    return this.premises.createPremise(req.user.userId, body);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.premises.getPremise(req.user.userId, req.user.email, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdatePremiseDto,
  ) {
    return this.premises.updatePremise(
      req.user.userId,
      req.user.email,
      id,
      body,
    );
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.premises.deletePremise(req.user.userId, req.user.email, id);
  }

  @Get(':id/slots')
  listSlots(
    @Req() req: any,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.premises.listSlots(
      req.user.userId,
      req.user.email,
      id,
      from,
      to,
    );
  }

  @Post(':id/slots')
  createSlot(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: CreatePremiseSlotDto,
  ) {
    return this.premises.createSlot(
      req.user.userId,
      req.user.email,
      id,
      body,
    );
  }

  @Patch(':id/slots/:slotId')
  updateSlot(
    @Req() req: any,
    @Param('id') id: string,
    @Param('slotId') slotId: string,
    @Body() body: UpdatePremiseSlotDto,
  ) {
    return this.premises.updateSlot(
      req.user.userId,
      req.user.email,
      id,
      slotId,
      body,
    );
  }

  @Delete(':id/slots/:slotId')
  removeSlot(
    @Req() req: any,
    @Param('id') id: string,
    @Param('slotId') slotId: string,
  ) {
    return this.premises.deleteSlot(
      req.user.userId,
      req.user.email,
      id,
      slotId,
    );
  }

  @Get(':id/members')
  listMembers(@Req() req: any, @Param('id') id: string) {
    return this.premises.listMembers(req.user.userId, req.user.email, id);
  }

  @Post(':id/members')
  addMember(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: AddPremiseMemberDto,
  ) {
    return this.premises.addMember(
      req.user.userId,
      req.user.email,
      id,
      body,
    );
  }

  @Patch(':id/members/:memberId')
  updateMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: UpdatePremiseMemberDto,
  ) {
    return this.premises.updateMember(
      req.user.userId,
      req.user.email,
      id,
      memberId,
      body,
    );
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.premises.removeMember(
      req.user.userId,
      req.user.email,
      id,
      memberId,
    );
  }
}
