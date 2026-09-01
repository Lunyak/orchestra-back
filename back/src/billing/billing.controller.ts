import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  listPlans() {
    return this.billing.listPlans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyBilling(@Req() req: { user: { userId: string } }) {
    return this.billing.getMyBilling(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  createCheckout(
    @Req() req: { user: { userId: string } },
    @Body() body: { planName?: string },
  ) {
    return this.billing.createCheckout(req.user.userId, body);
  }

  @Post('yookassa/webhook')
  handleYooKassaWebhook(
    @Body() body: { event?: string; object?: { id?: string } },
  ) {
    return this.billing.handleYooKassaNotification(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upgrade-request')
  requestUpgrade(
    @Req() req: { user: { userId: string } },
    @Body() body: { planName?: string; message?: string },
  ) {
    return this.billing.requestUpgrade(req.user.userId, body);
  }
}
