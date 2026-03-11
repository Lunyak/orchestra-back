import { Controller, Param, Post } from '@nestjs/common';
import { SiteEventViewsService } from './site-event-views.service';

@Controller('site/events')
export class SiteEventViewsController {
  constructor(private readonly views: SiteEventViewsService) {}

  /**
   * Public endpoint used by the marketing site to count Event page views.
   *
   * POST /site/events/:eventSlug/view
   */
  @Post(':eventSlug/view')
  async hit(@Param('eventSlug') eventSlug: string) {
    return this.views.hitEventView(eventSlug);
  }
}

