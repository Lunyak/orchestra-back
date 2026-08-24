import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AccountingEnabledGuard } from './accounting-enabled.guard';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';

@Module({
  imports: [MailModule],
  controllers: [AccountingController],
  providers: [AccountingService, AccountingEnabledGuard],
})
export class AccountingModule {}