import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { FilesModule } from '../files/files.module';
import { TroupeModule } from '../troupe/troupe.module';

@Module({
  imports: [FilesModule, TroupeModule],
  providers: [ProjectsService],
  controllers: [ProjectsController],
})
export class ProjectsModule {}
