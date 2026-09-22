import { Module } from '@nestjs/common';
import { DesktopReleasesController } from './desktop-releases.controller';
import { DesktopReleasesService } from './desktop-releases.service';

@Module({
  controllers: [DesktopReleasesController],
  providers: [DesktopReleasesService],
})
export class DesktopReleasesModule {}
