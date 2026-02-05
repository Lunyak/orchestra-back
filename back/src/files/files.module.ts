import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { FileStorageService } from './file-storage.service';
import { FilesController } from './files.controller';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [FileStorageService],
  controllers: [FilesController],
  exports: [FileStorageService],
})
export class FilesModule {}

