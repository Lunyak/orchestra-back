import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncPullDto, SyncPullSceneDto, SyncPushDto } from './dto/sync-change.dto';
import { SyncService } from './sync.service';

@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  push(@Req() req: any, @Body() body: SyncPushDto) {
    console.log('[sync] POST /sync/push received', {
      userId: req.user?.userId,
      bodyKeys: Object.keys(body),
      changesCount: body.changes?.length ?? 0,
      changes:
        body.changes?.map((c) => ({
          entityType: c.entityType,
          operation: c.operation,
          entityId: c.entityId,
        })) ?? [],
      rawBody: JSON.stringify(body).substring(0, 500), // Первые 500 символов для отладки
    });
    return this.syncService.applyChanges(req.user.userId, body.changes ?? []);
  }

  @Post('pull')
  pull(@Req() req: any, @Body() body: SyncPullDto) {
    return this.syncService.getChangesSince(
      req.user.userId,
      body.lastSyncAt,
      body.projectSlug,
    );
  }

  @Post('pull-scene')
  pullScene(@Req() req: any, @Body() body: SyncPullSceneDto) {
    return this.syncService.getSceneSnapshot(
      req.user.userId,
      body.projectSlug,
      body.sceneName,
    );
  }

  // Временный debug-эндпоинт, чтобы увидеть, что реально лежит в БД для текущего пользователя
  @Get('debug')
  debug(@Req() req: any) {
    return this.syncService.getChangesSince(req.user.userId, null);
  }

  // Временный debug-эндпоинт без фильтров по пользователю/updatedAt
  @Get('debug-all')
  debugAll() {
    return this.syncService.debugAll();
  }
}
