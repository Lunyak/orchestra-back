import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { FileStorageService } from './file-storage.service';
import { FilesController } from './files.controller';
import { LocalFileStorageService } from './local-file-storage.service';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [FileStorageService, LocalFileStorageService],
  controllers: [FilesController],
  exports: [FileStorageService, LocalFileStorageService],
})
export class FilesModule {}

