import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { YooKassaClient } from './yookassa.client';

@Module({
  imports: [MailModule],
  controllers: [BillingController],
  providers: [BillingService, YooKassaClient],
})
export class BillingModule {}
