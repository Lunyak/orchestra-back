import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesModule } from '../files/files.module';
import { AdminSiteEventViewsController } from './site-event-views.admin.controller';
import { SiteEventViewsController } from './site-event-views.controller';
import { SiteEventViewsService } from './site-event-views.service';

@Module({
  imports: [ConfigModule, FilesModule],
  controllers: [SiteEventViewsController, AdminSiteEventViewsController],
  providers: [SiteEventViewsService],
})
export class SiteAnalyticsModule {}

