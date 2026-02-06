import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  getUsers() {
    return this.admin.getUsers();
  }

  @Get('projects')
  getProjects() {
    return this.admin.getProjects();
  }

  @Get('plans')
  getPlans() {
    return this.admin.getPlans();
  }

  @Patch('users/:id/subscription')
  setUserSubscription(
    @Param('id') userId: string,
    @Body() body: { subscriptionId: string | null },
  ) {
    return this.admin.setUserSubscription(userId, body.subscriptionId ?? null);
  }

  @Patch('projects/:id/deleted')
  setProjectDeleted(
    @Param('id') projectId: string,
    @Body() body: { deleted: boolean },
  ) {
    return this.admin.setProjectDeleted(projectId, !!body.deleted);
  }
}
