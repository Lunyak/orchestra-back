import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { SiteEventViewsService } from './site-event-views.service';

@UseGuards(AdminGuard)
@Controller('admin/site')
export class AdminSiteEventViewsController {
  constructor(private readonly views: SiteEventViewsService) {}

  @Get('event-views')
  async getEventViews() {
    return this.views.getEventViews();
  }
}

