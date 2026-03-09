import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesModule } from '../files/files.module';
import { AdminController } from './admin.controller';
import { AdminFilesController } from './admin-files.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [AdminController, AdminFilesController],
  providers: [AdminService],
})
export class AdminModule {}
