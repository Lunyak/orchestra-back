import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

function optionalNumber(value: string | undefined): number | undefined {
  if (value == null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(
    @Req() req: { user: { userId: string; email: string } },
    @Query('horizonDays') horizonDays?: string,
    @Query('rehearsalsLimit') rehearsalsLimit?: string,
    @Query('tasksLimit') tasksLimit?: string,
    @Query('actionsLimit') actionsLimit?: string,
  ) {
    return this.dashboard.getDashboard(req.user.userId, req.user.email, {
      horizonDays: optionalNumber(horizonDays),
      rehearsalsLimit: optionalNumber(rehearsalsLimit),
      tasksLimit: optionalNumber(tasksLimit),
      actionsLimit: optionalNumber(actionsLimit),
    });
  }
}
