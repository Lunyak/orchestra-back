import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesModule } from '../files/files.module';
import { AdminController } from './admin.controller';
import { AdminFilesController } from './admin-files.controller';
import { AdminTheaterAssetsController } from './admin-theater-assets.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [
    AdminController,
    AdminFilesController,
    AdminTheaterAssetsController,
  ],
  providers: [AdminService],
})
export class AdminModule {}
