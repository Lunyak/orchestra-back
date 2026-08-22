import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddPremiseMemberDto } from './dto/add-premise-member.dto';
import { CreatePremiseDto } from './dto/create-premise.dto';
import { CreatePremiseRentalDto } from './dto/create-premise-rental.dto';
import { CreatePremiseRentalAgreementDto } from './dto/create-premise-rental-agreement.dto';
import { CreatePremiseSlotDto } from './dto/create-premise-slot.dto';
import { UpdatePremiseDto } from './dto/update-premise.dto';
import { UpdatePremiseMemberDto } from './dto/update-premise-member.dto';
import { UpdatePremiseRentalPaymentDto } from './dto/update-premise-rental-payment.dto';
import { UpdatePremiseRentalStatusDto } from './dto/update-premise-rental-status.dto';
import { UpdatePremiseSlotDto } from './dto/update-premise-slot.dto';
import { PremisesService } from './premises.service';

@UseGuards(JwtAuthGuard)
@Controller('premises')
export class PremisesController {
  constructor(private readonly premises: PremisesService) {}

  @Get()
  list(
    @Req() req: any,
    @Query('theaterId') theaterId?: string,
    @Query('studioId') studioId?: string,
  ) {
    return this.premises.listPremises(
      req.user.userId,
      req.user.email,
      theaterId,
      studioId,
    );
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

  @Get(':id/rentals')
  listRentals(@Req() req: any, @Param('id') id: string) {
    return this.premises.listRentals(req.user.userId, req.user.email, id);
  }

  @Get(':id/rentals/:rentalId')
  getRental(
    @Req() req: any,
    @Param('id') id: string,
    @Param('rentalId') rentalId: string,
  ) {
    return this.premises.getRental(
      req.user.userId,
      req.user.email,
      id,
      rentalId,
    );
  }

  @Post(':id/rentals')
  createRental(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: CreatePremiseRentalDto,
  ) {
    return this.premises.createRental(
      req.user.userId,
      req.user.email,
      id,
      body,
    );
  }

  @Patch(':id/rentals/:rentalId/status')
  updateRentalStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Param('rentalId') rentalId: string,
    @Body() body: UpdatePremiseRentalStatusDto,
  ) {
    return this.premises.updateRentalStatus(
      req.user.userId,
      req.user.email,
      id,
      rentalId,
      body,
    );
  }

  @Patch(':id/rentals/:rentalId/payments/:paymentId')
  updateRentalPayment(
    @Req() req: any,
    @Param('id') id: string,
    @Param('rentalId') rentalId: string,
    @Param('paymentId') paymentId: string,
    @Body() body: UpdatePremiseRentalPaymentDto,
  ) {
    return this.premises.updateRentalPayment(
      req.user.userId,
      req.user.email,
      id,
      rentalId,
      paymentId,
      body,
    );
  }

  @Post(':id/rentals/:rentalId/agreement')
  createRentalAgreement(
    @Req() req: any,
    @Param('id') id: string,
    @Param('rentalId') rentalId: string,
    @Body() body: CreatePremiseRentalAgreementDto,
  ) {
    return this.premises.createRentalAgreement(
      req.user.userId,
      req.user.email,
      id,
      rentalId,
      body,
    );
  }

  @Post(':id/rentals/:rentalId/agreement/generate')
  generateRentalAgreement(
    @Req() req: any,
    @Param('id') id: string,
    @Param('rentalId') rentalId: string,
  ) {
    return this.premises.generateRentalAgreement(
      req.user.userId,
      req.user.email,
      id,
      rentalId,
    );
  }

  @Post(':id/rentals/:rentalId/agreement/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  uploadRentalAgreement(
    @Req() req: any,
    @Param('id') id: string,
    @Param('rentalId') rentalId: string,
    @Query('kind') kind: 'uploaded' | 'signed',
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('Файл не передан');
    if (kind !== 'uploaded' && kind !== 'signed') {
      throw new BadRequestException('Некорректный тип документа');
    }
    return this.premises.uploadRentalAgreementDocument(
      req.user.userId,
      req.user.email,
      id,
      rentalId,
      kind,
      file,
    );
  }

  @Get(':id/rentals/:rentalId/agreement/documents/:documentId')
  async downloadRentalAgreement(
    @Req() req: any,
    @Param('id') id: string,
    @Param('rentalId') rentalId: string,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const { document, object } = await this.premises.getRentalAgreementDocument(
      req.user.userId,
      req.user.email,
      id,
      rentalId,
      documentId,
    );
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
    );
    if ('localPath' in object) {
      const fileStat = await stat(object.localPath);
      res.setHeader('Content-Length', String(fileStat.size));
      return createReadStream(object.localPath).pipe(res);
    }
    if (object.contentLength != null) {
      res.setHeader('Content-Length', String(object.contentLength));
    }
    return object.body.pipe(res);
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
    return this.premises.createSlot(req.user.userId, req.user.email, id, body);
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
    return this.premises.addMember(req.user.userId, req.user.email, id, body);
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
