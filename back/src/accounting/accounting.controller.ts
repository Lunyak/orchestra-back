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
import { AccountingService } from './accounting.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { SetCollectionParticipantsDto } from './dto/set-collection-participants.dto';
import { SetCollectionTariffsDto } from './dto/set-collection-tariffs.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@UseGuards(JwtAuthGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Get('collections')
  listCollections(@Req() req: any) {
    return this.accounting.listCollections(req.user.userId, req.user.email);
  }

  @Post('collections')
  createCollection(@Req() req: any, @Body() body: CreateCollectionDto) {
    return this.accounting.createCollection(
      req.user.userId,
      req.user.email,
      body,
    );
  }

  @Get('collections/:id')
  getCollection(@Req() req: any, @Param('id') id: string) {
    return this.accounting.getCollection(req.user.userId, req.user.email, id);
  }

  @Patch('collections/:id')
  updateCollection(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateCollectionDto,
  ) {
    return this.accounting.updateCollection(
      req.user.userId,
      req.user.email,
      id,
      body,
    );
  }

  @Delete('collections/:id')
  deleteCollection(@Req() req: any, @Param('id') id: string) {
    return this.accounting.deleteCollection(
      req.user.userId,
      req.user.email,
      id,
    );
  }

  @Put('collections/:id/tariffs')
  setTariffs(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: SetCollectionTariffsDto,
  ) {
    return this.accounting.setTariffs(
      req.user.userId,
      req.user.email,
      id,
      body,
    );
  }

  @Put('collections/:id/participants')
  setParticipants(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: SetCollectionParticipantsDto,
  ) {
    return this.accounting.setParticipants(
      req.user.userId,
      req.user.email,
      id,
      body,
    );
  }

  @Post('collections/:id/contributions')
  addContribution(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: CreateContributionDto,
  ) {
    return this.accounting.addContribution(
      req.user.userId,
      req.user.email,
      id,
      body,
    );
  }

  @Delete('collections/:id/contributions/:contributionId')
  removeContribution(
    @Req() req: any,
    @Param('id') id: string,
    @Param('contributionId') contributionId: string,
  ) {
    return this.accounting.removeContribution(
      req.user.userId,
      req.user.email,
      id,
      contributionId,
    );
  }

  @Post('collections/:id/remind')
  remindDebtors(@Req() req: any, @Param('id') id: string) {
    return this.accounting.remindDebtors(
      req.user.userId,
      req.user.email,
      id,
    );
  }
}
