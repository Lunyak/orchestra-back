import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [NotificationsModule],
  providers: [SyncService],
  controllers: [SyncController],
})
export class SyncModule {}

