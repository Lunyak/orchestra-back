import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [FilesModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
