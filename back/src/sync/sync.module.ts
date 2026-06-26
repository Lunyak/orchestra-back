import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SyncChangeApplierService } from './sync-change-applier.service';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [NotificationsModule],
  providers: [SyncService, SyncChangeApplierService],
  controllers: [SyncController],
})
export class SyncModule {}
