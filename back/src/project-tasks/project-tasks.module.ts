import { Module } from '@nestjs/common';
import { ProjectTasksController } from './project-tasks.controller';
import { ProjectTasksService } from './project-tasks.service';

@Module({
  controllers: [ProjectTasksController],
  providers: [ProjectTasksService],
  exports: [ProjectTasksService],
})
export class ProjectTasksModule {}
