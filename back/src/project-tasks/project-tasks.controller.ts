import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateProjectTaskDto,
  ImportRequisiteTasksDto,
  UpdateProjectTaskDto,
} from './dto/project-tasks.dto';
import { ProjectTasksService } from './project-tasks.service';

@UseGuards(JwtAuthGuard)
@Controller('project-tasks')
export class ProjectTasksController {
  constructor(private readonly tasks: ProjectTasksService) {}

  @Get()
  list(@Req() req: any, @Query('projectSlug') projectSlug: string) {
    return this.tasks.list(req.user.userId, req.user.email, projectSlug);
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateProjectTaskDto) {
    return this.tasks.create(req.user.userId, req.user.email, body);
  }

  @Post('import-requisites')
  importRequisites(@Req() req: any, @Body() body: ImportRequisiteTasksDto) {
    return this.tasks.importRequisites(req.user.userId, req.user.email, body);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateProjectTaskDto,
  ) {
    return this.tasks.update(req.user.userId, req.user.email, id, body);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.tasks.remove(req.user.userId, id);
  }
}
