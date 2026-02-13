import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { AttendanceService } from './services/attendance.service';
import { ProfileService as TelegramProfileService } from './services/profile.service';
import { RehearsalsModule } from '../rehearsals/rehearsals.module';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [RehearsalsModule, ProfileModule],
  providers: [TelegramService, AttendanceService, TelegramProfileService],
  exports: [TelegramService],
})
export class TelegramModule {}
