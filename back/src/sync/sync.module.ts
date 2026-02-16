import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [NotificationsModule, FilesModule],
  providers: [SyncService],
  controllers: [SyncController],
})
export class SyncModule {}
