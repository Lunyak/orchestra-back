import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FileStorageService } from '../files/file-storage.service';
import { LocalFileStorageService } from '../files/local-file-storage.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { SyncChangeDto } from './dto/sync-change.dto';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsGateway,
    private readonly config: ConfigService,
    private readonly fileStorage: FileStorageService,
    private readonly localFileStorage: LocalFileStorageService,
  ) {}

  private normalizeBool(v: any, fallback = false): boolean {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === 'true' || s === '1' || s === 'yes') return true;
      if (s === 'false' || s === '0' || s === 'no') return false;
    }
    return fallback;
  }

  private normalizeInt(v: any, fallback: number): number {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.trunc(n);
  }

  private normalizeFloat(v: any, fallback: number): number {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    return n;
  }

  private normalizeString(v: any, fallback = ''): string {
    const s = typeof v === 'string' ? v : String(v ?? '');
    const t = s.trim();
    return t || fallback;
  }

  private normalizeVec3(v: any, fallback: [number, number, number]): [number, number, number] {
    if (!Array.isArray(v) || v.length !== 3) return fallback;
    const x = this.normalizeFloat(v[0], fallback[0]);
    const y = this.normalizeFloat(v[1], fallback[1]);
    const z = this.normalizeFloat(v[2], fallback[2]);
    return [x, y, z];
  }

  private async syncStepsFromLegacySceneSnapshot(sceneId: string, legacySceneSnapshot: any) {
    const stepsValue = legacySceneSnapshot?.steps;
    if (!Array.isArray(stepsValue)) return;

    const steps = stepsValue as any[];
    const parsed = steps
      .map((st: any, idx: number) => {
        const sourceId = this.normalizeInt(st?.id, -1);
        if (sourceId <= 0) return null;
        const id = `${sceneId}:${sourceId}`;
        const rawDuration = typeof st?.durationMin === 'number' ? st.durationMin : null;
        const durationMin =
          rawDuration != null && Number.isFinite(rawDuration) && rawDuration > 0
            ? Math.max(1, Math.min(480, Math.trunc(rawDuration)))
            : null;
        const kanbanStatus =
          typeof st?.kanbanStatus === 'string' && st.kanbanStatus.trim()
            ? st.kanbanStatus.trim()
            : null;
        const kanbanOrderRaw = typeof st?.kanbanOrder === 'number' ? st.kanbanOrder : null;
        const kanbanOrder =
          kanbanOrderRaw != null && Number.isFinite(kanbanOrderRaw)
            ? Math.trunc(kanbanOrderRaw)
            : null;
        const cast =
          st?.cast && typeof st.cast === 'object' && !Array.isArray(st.cast)
            ? (st.cast as Record<string, unknown>)
            : null;
        return {
          id,
          sceneId,
          sourceId,
          title: this.normalizeString(st?.title, `Step ${sourceId}`),
          markdown: typeof st?.markdown === 'string' ? st.markdown : null,
          playMarkdown: typeof st?.playMarkdown === 'string' ? st.playMarkdown : null,
          durationMin,
          kanbanStatus,
          kanbanOrder,
          cast,
          order: idx,
          requisites: Array.isArray(st?.requisites) ? (st.requisites as any[]) : [],
          lightPlot: Array.isArray(st?.lightPlot) ? (st.lightPlot as any[]) : [],
          theaterModels: Array.isArray(st?.theaterModels) ? (st.theaterModels as any[]) : [],
          theaterSpotlights: Array.isArray(st?.theaterSpotlights)
            ? (st.theaterSpotlights as any[])
            : [],
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      sceneId: string;
      sourceId: number;
      title: string;
      markdown: string | null;
      playMarkdown: string | null;
      durationMin: number | null;
      kanbanStatus: string | null;
      kanbanOrder: number | null;
      cast: Record<string, unknown> | null;
      order: number;
      requisites: any[];
      lightPlot: any[];
      theaterModels: any[];
      theaterSpotlights: any[];
    }>;

    if (parsed.length === 0) return;

    const stepIds = parsed.map((x) => x.id);

    const requisitesData = parsed.flatMap((st) =>
      (st.requisites ?? [])
        .map((r: any) => {
          const sourceId = this.normalizeInt(r?.id, -1);
          if (sourceId <= 0) return null;
          const label = this.normalizeString(r?.label, '');
          if (!label) return null;
          return {
            stepId: st.id,
            sourceId,
            label,
            checked: this.normalizeBool(r?.checked, false),
          };
        })
        .filter(Boolean),
    ) as Array<{ stepId: string; sourceId: number; label: string; checked: boolean }>;

    const lightPlotData = parsed.flatMap((st) =>
      (st.lightPlot ?? [])
        .map((f: any) => {
          const sourceId = this.normalizeInt(f?.id, -1);
          if (sourceId <= 0) return null;
          const label = this.normalizeString(f?.label, '');
          if (!label) return null;
          return {
            stepId: st.id,
            sourceId,
            label,
            channel:
              typeof f?.channel === 'string' && f.channel.trim() ? f.channel.trim() : null,
            x: this.normalizeInt(f?.x, 0),
            y: this.normalizeInt(f?.y, 0),
            angle: this.normalizeInt(f?.angle, 0),
            length: this.normalizeInt(f?.length, 0),
          };
        })
        .filter(Boolean),
    ) as Array<{
      stepId: string;
      sourceId: number;
      label: string;
      channel: string | null;
      x: number;
      y: number;
      angle: number;
      length: number;
    }>;

    const theaterModelsData = parsed.flatMap((st) =>
      (st.theaterModels ?? [])
        .map((m: any) => {
          const sourceId = this.normalizeInt(m?.id, -1);
          if (sourceId <= 0) return null;
          const name = this.normalizeString(m?.name, `Model ${sourceId}`);
          const type = this.normalizeString(m?.type, 'builtin');
          return {
            stepId: st.id,
            sourceId,
            name,
            type,
            builtin: typeof m?.builtin === 'string' && m.builtin.trim() ? m.builtin.trim() : null,
            allowOutOfBounds: this.normalizeBool(m?.allowOutOfBounds, false),
            position: this.normalizeVec3(m?.position, [0, 0, 0]),
            rotation: this.normalizeVec3(m?.rotation, [0, 0, 0]),
            scale: this.normalizeVec3(m?.scale, [1, 1, 1]),
          };
        })
        .filter(Boolean),
    ) as Array<{
      stepId: string;
      sourceId: number;
      name: string;
      type: string;
      builtin: string | null;
      allowOutOfBounds: boolean;
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    }>;

    const theaterSpotlightsData = parsed.flatMap((st) =>
      (st.theaterSpotlights ?? [])
        .map((sp: any) => {
          const sourceId = this.normalizeInt(sp?.id, -1);
          if (sourceId <= 0) return null;
          const label = this.normalizeString(sp?.label, `Spotlight ${sourceId}`);
          return {
            stepId: st.id,
            sourceId,
            label,
            position: this.normalizeVec3(sp?.position, [0, 6, 6]),
            target: this.normalizeVec3(sp?.target, [0, 1, 2]),
            angleDeg: this.normalizeInt(sp?.angleDeg, 20),
            intensity: this.normalizeFloat(sp?.intensity, 0.7),
            color: this.normalizeString(sp?.color, '#ffffff'),
            enabled: this.normalizeBool(sp?.enabled, true),
            channel: this.normalizeInt(sp?.channel, sourceId),
            isRgb: this.normalizeBool(sp?.isRgb, false),
          };
        })
        .filter(Boolean),
    ) as Array<{
      stepId: string;
      sourceId: number;
      label: string;
      position: [number, number, number];
      target: [number, number, number];
      angleDeg: number;
      intensity: number;
      color: string;
      enabled: boolean;
      channel: number;
      isRgb: boolean;
    }>;

    // Upsert steps + overwrite nested свет/3D данные из legacy-снапшота сцены.
    const stepUpserts = parsed.map((st) =>
      this.prisma.step.upsert({
        where: { id: st.id },
        update: {
          title: st.title,
          markdown: st.markdown,
          playMarkdown: st.playMarkdown,
          durationMin: st.durationMin,
          kanbanStatus: st.kanbanStatus,
          kanbanOrder: st.kanbanOrder,
          cast: st.cast
            ? (st.cast as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          order: st.order,
          deletedAt: null,
        },
        create: {
          id: st.id,
          sceneId: st.sceneId,
          sourceId: st.sourceId,
          title: st.title,
          markdown: st.markdown,
          playMarkdown: st.playMarkdown,
          durationMin: st.durationMin,
          kanbanStatus: st.kanbanStatus,
          kanbanOrder: st.kanbanOrder,
          cast: st.cast
            ? (st.cast as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          order: st.order,
        },
      }),
    );

    await this.prisma.$transaction([
      ...stepUpserts,
      this.prisma.stepRequisite.deleteMany({ where: { stepId: { in: stepIds } } }),
      this.prisma.stepLightPlot.deleteMany({ where: { stepId: { in: stepIds } } }),
      this.prisma.theaterModel.deleteMany({ where: { stepId: { in: stepIds } } }),
      this.prisma.theaterSpotlight.deleteMany({ where: { stepId: { in: stepIds } } }),
      ...(requisitesData.length
        ? [this.prisma.stepRequisite.createMany({ data: requisitesData })]
        : []),
      ...(lightPlotData.length
        ? [this.prisma.stepLightPlot.createMany({ data: lightPlotData })]
        : []),
      ...(theaterModelsData.length
        ? [this.prisma.theaterModel.createMany({ data: theaterModelsData })]
        : []),
      ...(theaterSpotlightsData.length
        ? [this.prisma.theaterSpotlight.createMany({ data: theaterSpotlightsData })]
        : []),
    ]);
  }

  async applyChanges(userId: string, changes: SyncChangeDto[]) {
    console.log('[sync] applyChanges called', {
      userId,
      changesCount: changes.length,
      changes: changes.map((c) => ({
        entityType: c.entityType,
        operation: c.operation,
        entityId: c.entityId,
      })),
    });

    for (const change of changes) {
      const { entityType, operation, payload } = change;

      console.log('[sync] processing change', {
        entityType,
        operation,
        entityId: change.entityId,
      });

      const projectId = await this.getProjectIdForChange(entityType, payload);
      if (projectId && !(await this.canUserWriteToProject(userId, projectId))) {
        throw new ForbiddenException(
          'Только владелец или участник с правом редактирования может вносить изменения',
        );
      }

      try {
        if (entityType === 'Project') {
          await this.applyProjectChange(userId, operation, payload);
        }
        if (entityType === 'Scene') {
          await this.applySceneChange(userId, operation, payload);
        }
        if (entityType === 'Step') {
          await this.applyStepChange(userId, operation, payload);
        }
        if (entityType === 'PlaylistItem') {
          await this.applyPlaylistItemChange(operation, payload);
        }
        if (entityType === 'Sound') {
          await this.applySoundChange(operation, payload);
        }
        if (entityType === 'GlobalLightChannel') {
          await this.applyGlobalLightChannelChange(operation, payload);
        }
        if (entityType === 'TheaterLayout') {
          await this.applyTheaterLayoutChange(operation, payload);
        }
      } catch (error) {
        // Временно логируем ошибки синка, чтобы понимать, почему данные не попадают в БД

        console.error('[sync] failed to apply change', {
          userId,
          entityType,
          operation,
          payloadSummary: {
            id: payload?.id,
            projectId: payload?.projectId,
            sceneId: payload?.sceneId,
          },
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // НЕ пробрасываем ошибку, чтобы увидеть все проблемы за один раз
      }
    }
    return { ok: true };
  }

  private async applyProjectChange(
    userId: string,
    operation: string,
    payload: any,
  ) {
    if (operation === 'delete') {
      await this.prisma.project.updateMany({
        where: { id: payload.id, ownerId: userId },
        data: { deletedAt: new Date(payload.updatedAt) },
      });
      return;
    }

    await this.prisma.project.upsert({
      where: { id: payload.id },
      update: {
        name: payload.name,
        slug: payload.slug,
        description: payload.description ?? null,
      },
      create: {
        id: payload.id,
        ownerId: userId,
        slug: payload.slug,
        name: payload.name,
        description: payload.description ?? null,
      },
    });
  }

  private useLocalStorage(): boolean {
    return this.config.get<string>('STORAGE_TYPE') === 'local';
  }

  private getFileStorage(): FileStorageService | LocalFileStorageService {
    return this.useLocalStorage() ? this.localFileStorage : this.fileStorage;
  }

  /** Из значения (URL или ключ) извлечь ключ хранилища для удаления. */
  private fileValueToStorageKey(
    value: string,
    projectId: string,
  ): string | null {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      // Паттерн для /files/play/... (backend API)
      const playMatch = trimmed.match(/\/files\/play\/([^/?#]+)/);
      if (playMatch) {
        try {
          return decodeURIComponent(playMatch[1]);
        } catch {
          return null;
        }
      }
      // Паттерн для прямых ссылок MinIO: /orchestra-media/projectId/type/filename
      const minioMatch = trimmed.match(
        /\/orchestra-media\/([^/?#]+\/[^/?#]+\/[^/?#]+)/,
      );
      if (minioMatch) {
        try {
          return decodeURIComponent(minioMatch[1]);
        } catch {
          return null;
        }
      }
      return null;
    }
    if (trimmed.startsWith(projectId + '/')) return trimmed;
    return null;
  }

  private async applySceneChange(
    userId: string,
    operation: string,
    payload: any,
  ) {
    if (operation === 'delete') {
      await this.prisma.scene.updateMany({
        where: {
          id: payload.id,
          project: { ownerId: userId },
        },
        data: { deletedAt: new Date(payload.updatedAt) },
      });
      return;
    }

    console.log('[sync] applying Scene change', {
      operation,
      id: payload.id,
      projectId: payload.projectId,
      name: payload.name,
    });

    const result = await this.prisma.scene.upsert({
      where: { id: payload.id },
      update: {
        name: payload.name,
      },
      create: {
        id: payload.id,
        name: payload.name,
        projectId: payload.projectId,
      },
    });

    console.log('[sync] Scene upsert result', {
      id: result.id,
      name: result.name,
    });

    if (payload.projectId) {
      this.notifications.notifySceneUpdated(payload.projectId);
    }
  }

  private async applyPlaylistItemChange(operation: string, payload: any) {
    const sceneId = String(payload?.sceneId ?? '').trim();
    const sourceId = this.normalizeInt(payload?.sourceId, -1);
    if (!sceneId || sourceId <= 0) return;

    if (operation === 'delete') {
      await this.prisma.playlistItem.deleteMany({
        where: { sceneId, sourceId },
      });
      return;
    }

    const order = this.normalizeInt(payload?.order, 0);
    const title = this.normalizeString(payload?.title, `Track ${sourceId}`);
    const file = this.normalizeString(payload?.file, '');

    const fadeMs = this.normalizeInt(payload?.fadeMs, 0);
    const loop = this.normalizeBool(payload?.loop, false);
    const remoteUrl =
      typeof payload?.remoteUrl === 'string' && payload.remoteUrl.trim()
        ? payload.remoteUrl.trim()
        : null;
    const remoteKey =
      typeof payload?.remoteKey === 'string' && payload.remoteKey.trim()
        ? payload.remoteKey.trim()
        : null;

    const existing = await this.prisma.playlistItem.findFirst({
      where: { sceneId, sourceId },
      select: { id: true },
    });
    if (existing?.id) {
      await this.prisma.playlistItem.update({
        where: { id: existing.id },
        data: { order, title, file, fadeMs, loop, remoteUrl, remoteKey },
      });
      return;
    }
    await this.prisma.playlistItem.create({
      data: { sceneId, sourceId, order, title, file, fadeMs, loop, remoteUrl, remoteKey },
    });
  }

  private async applySoundChange(operation: string, payload: any) {
    const sceneId = String(payload?.sceneId ?? '').trim();
    const sourceId = this.normalizeInt(payload?.sourceId, -1);
    if (!sceneId || sourceId <= 0) return;

    if (operation === 'delete') {
      await this.prisma.sound.deleteMany({
        where: { sceneId, sourceId },
      });
      return;
    }

    const title = this.normalizeString(payload?.title, `Sound ${sourceId}`);
    const file = this.normalizeString(payload?.file, '');
    const icon =
      typeof payload?.icon === 'string' && payload.icon.trim()
        ? payload.icon.trim()
        : null;
    const volume =
      payload?.volume != null && Number.isFinite(Number(payload.volume))
        ? Number(payload.volume)
        : 1;
    const fadeMs = this.normalizeInt(payload?.fadeMs, 0);
    const loop = this.normalizeBool(payload?.loop, false);
    const remoteUrl =
      typeof payload?.remoteUrl === 'string' && payload.remoteUrl.trim()
        ? payload.remoteUrl.trim()
        : null;
    const remoteKey =
      typeof payload?.remoteKey === 'string' && payload.remoteKey.trim()
        ? payload.remoteKey.trim()
        : null;
    const iconRemoteUrl =
      typeof payload?.iconRemoteUrl === 'string' && payload.iconRemoteUrl.trim()
        ? payload.iconRemoteUrl.trim()
        : null;
    const iconRemoteKey =
      typeof payload?.iconRemoteKey === 'string' && payload.iconRemoteKey.trim()
        ? payload.iconRemoteKey.trim()
        : null;

    const existing = await this.prisma.sound.findFirst({
      where: { sceneId, sourceId },
      select: { id: true },
    });
    if (existing?.id) {
      await this.prisma.sound.update({
        where: { id: existing.id },
        data: {
          title,
          file,
          icon,
          remoteUrl,
          remoteKey,
          iconRemoteUrl,
          iconRemoteKey,
          volume,
          fadeMs,
          loop,
        },
      });
      return;
    }
    await this.prisma.sound.create({
      data: {
        sceneId,
        sourceId,
        title,
        file,
        icon,
        remoteUrl,
        remoteKey,
        iconRemoteUrl,
        iconRemoteKey,
        volume,
        fadeMs,
        loop,
      },
    });
  }

  private async applyGlobalLightChannelChange(operation: string, payload: any) {
    const sceneId = String(payload?.sceneId ?? '').trim();
    const index = this.normalizeInt(payload?.index, -1);
    if (!sceneId || index < 0) return;

    if (operation === 'delete') {
      await this.prisma.globalLightChannel.deleteMany({
        where: { sceneId, index },
      });
      return;
    }

    const raw = this.normalizeString(payload?.raw, '');
    const updated = await this.prisma.globalLightChannel.updateMany({
      where: { sceneId, index },
      data: { raw, index },
    });
    if (updated.count > 0) return;
    await this.prisma.globalLightChannel.create({
      data: { sceneId, index, raw },
    });
  }

  private async applyTheaterLayoutChange(operation: string, payload: any) {
    const sceneId = String(payload?.sceneId ?? '').trim();
    if (!sceneId) return;
    if (operation === 'delete') {
      await this.prisma.theaterLayout.deleteMany({ where: { sceneId } });
      return;
    }
    const num = (v: any, fallback: number) =>
      v != null && Number.isFinite(Number(v)) ? Number(v) : fallback;
    await this.prisma.theaterLayout.upsert({
      where: { sceneId },
      update: {
        hallWidth: this.normalizeInt(payload?.hallWidth, 0),
        hallDepth: this.normalizeInt(payload?.hallDepth, 0),
        wallHeight: this.normalizeInt(payload?.wallHeight, 0),
        stageWidth: this.normalizeInt(payload?.stageWidth, 0),
        stageDepth: this.normalizeInt(payload?.stageDepth, 0),
        stageHeight: this.normalizeInt(payload?.stageHeight, 0),
        stageZ: this.normalizeInt(payload?.stageZ, 0),
        audienceStartZ: this.normalizeInt(payload?.audienceStartZ, 0),
        seatRows: this.normalizeInt(payload?.seatRows, 0),
        seatsPerRow: this.normalizeInt(payload?.seatsPerRow, 0),
        seatSpacing: num(payload?.seatSpacing, 0),
        rowSpacing: num(payload?.rowSpacing, 0),
        rowRise: num(payload?.rowRise, 0),
        aisleWidth: num(payload?.aisleWidth, 0),
        aisleCenterX: num(payload?.aisleCenterX, 0),
        doorWidth: num(payload?.doorWidth, 0),
        doorHeight: num(payload?.doorHeight, 0),
        doorZ: num(payload?.doorZ, 0),
      },
      create: {
        sceneId,
        hallWidth: this.normalizeInt(payload?.hallWidth, 0),
        hallDepth: this.normalizeInt(payload?.hallDepth, 0),
        wallHeight: this.normalizeInt(payload?.wallHeight, 0),
        stageWidth: this.normalizeInt(payload?.stageWidth, 0),
        stageDepth: this.normalizeInt(payload?.stageDepth, 0),
        stageHeight: this.normalizeInt(payload?.stageHeight, 0),
        stageZ: this.normalizeInt(payload?.stageZ, 0),
        audienceStartZ: this.normalizeInt(payload?.audienceStartZ, 0),
        seatRows: this.normalizeInt(payload?.seatRows, 0),
        seatsPerRow: this.normalizeInt(payload?.seatsPerRow, 0),
        seatSpacing: num(payload?.seatSpacing, 0),
        rowSpacing: num(payload?.rowSpacing, 0),
        rowRise: num(payload?.rowRise, 0),
        aisleWidth: num(payload?.aisleWidth, 0),
        aisleCenterX: num(payload?.aisleCenterX, 0),
        doorWidth: num(payload?.doorWidth, 0),
        doorHeight: num(payload?.doorHeight, 0),
        doorZ: num(payload?.doorZ, 0),
      },
    });
  }

  private async applyStepChange(
    userId: string,
    operation: string,
    payload: any,
  ) {
    if (operation === 'delete') {
      await this.prisma.step.updateMany({
        where: {
          id: payload.id,
          scene: {
            project: { ownerId: userId },
          },
        },
        data: { deletedAt: new Date(payload.updatedAt) },
      });
      return;
    }

    console.log('[sync] applying Step change', {
      operation,
      id: payload.id,
      sceneId: payload.sceneId,
      sourceId: payload.sourceId,
      title: payload.title,
    });

    // Проверяем, существует ли Scene перед созданием Step
    const sceneExists = await this.prisma.scene.findUnique({
      where: { id: payload.sceneId },
    });

    if (!sceneExists) {
      console.warn('[sync] Scene does not exist for Step', {
        stepId: payload.id,
        sceneId: payload.sceneId,
      });
    }

    const result = await this.prisma.step.upsert({
      where: { id: payload.id },
      update: {
        title: payload.title,
        markdown: payload.markdown ?? null,
        playMarkdown: payload.playMarkdown ?? null,
        // Если шаг ранее "удалили" (soft delete), любая upsert/update должна возвращать его в активное состояние.
        deletedAt: null,
        durationMin:
          payload.durationMin != null && Number.isFinite(Number(payload.durationMin))
            ? Math.trunc(Number(payload.durationMin))
            : undefined,
        kanbanStatus:
          typeof payload.kanbanStatus === 'string' && payload.kanbanStatus.trim()
            ? payload.kanbanStatus.trim()
            : undefined,
        kanbanOrder:
          payload.kanbanOrder != null && Number.isFinite(Number(payload.kanbanOrder))
            ? Math.trunc(Number(payload.kanbanOrder))
            : undefined,
        cast:
          payload.cast && typeof payload.cast === 'object' && !Array.isArray(payload.cast)
            ? payload.cast
            : undefined,
        order: payload.order,
      },
      create: {
        id: payload.id,
        sceneId: payload.sceneId,
        sourceId: payload.sourceId,
        title: payload.title,
        markdown: payload.markdown ?? null,
        playMarkdown: payload.playMarkdown ?? null,
        deletedAt: null,
        durationMin:
          payload.durationMin != null && Number.isFinite(Number(payload.durationMin))
            ? Math.trunc(Number(payload.durationMin))
            : null,
        kanbanStatus:
          typeof payload.kanbanStatus === 'string' && payload.kanbanStatus.trim()
            ? payload.kanbanStatus.trim()
            : null,
        kanbanOrder:
          payload.kanbanOrder != null && Number.isFinite(Number(payload.kanbanOrder))
            ? Math.trunc(Number(payload.kanbanOrder))
            : null,
        cast:
          payload.cast && typeof payload.cast === 'object' && !Array.isArray(payload.cast)
            ? payload.cast
            : Prisma.DbNull,
        order: payload.order,
      },
    });

    console.log('[sync] Step upsert result', {
      id: result.id,
      title: result.title,
    });

    // Optional: normalize nested step data if provided in payload (requisites/light/theater).
    try {
      const stepId = payload.id as string;
      if (typeof stepId !== 'string' || !stepId) return;

      const requisitesValue = payload.requisites;
      const lightPlotValue = payload.lightPlot;
      const theaterModelsValue = payload.theaterModels;
      const theaterSpotlightsValue = payload.theaterSpotlights;

      const tx: any[] = [];

      if (Array.isArray(requisitesValue)) {
        const data = requisitesValue
          .map((r: any) => {
            const sourceId = this.normalizeInt(r?.id, -1);
            if (sourceId <= 0) return null;
            const label = this.normalizeString(r?.label, '');
            if (!label) return null;
            return {
              stepId,
              sourceId,
              label,
              checked: this.normalizeBool(r?.checked, false),
            };
          })
          .filter(
            (x): x is { stepId: string; sourceId: number; label: string; checked: boolean } =>
              x !== null,
          );
        tx.push(this.prisma.stepRequisite.deleteMany({ where: { stepId } }));
        if (data.length) tx.push(this.prisma.stepRequisite.createMany({ data }));
      }

      if (Array.isArray(lightPlotValue)) {
        const data = lightPlotValue
          .map((f: any) => {
            const sourceId = this.normalizeInt(f?.id, -1);
            if (sourceId <= 0) return null;
            const label = this.normalizeString(f?.label, '');
            if (!label) return null;
            return {
              stepId,
              sourceId,
              label,
              channel:
                typeof f?.channel === 'string' && f.channel.trim()
                  ? f.channel.trim()
                  : null,
              x: this.normalizeInt(f?.x, 0),
              y: this.normalizeInt(f?.y, 0),
              angle: this.normalizeInt(f?.angle, 0),
              length: this.normalizeInt(f?.length, 0),
            };
          })
          .filter(
            (x): x is {
              stepId: string;
              sourceId: number;
              label: string;
              channel: string | null;
              x: number;
              y: number;
              angle: number;
              length: number;
            } => x !== null,
          );
        tx.push(this.prisma.stepLightPlot.deleteMany({ where: { stepId } }));
        if (data.length) tx.push(this.prisma.stepLightPlot.createMany({ data }));
      }

      if (Array.isArray(theaterModelsValue)) {
        const data = theaterModelsValue
          .map((m: any) => {
            const sourceId = this.normalizeInt(m?.id, -1);
            if (sourceId <= 0) return null;
            const name = this.normalizeString(m?.name, `Model ${sourceId}`);
            const type = this.normalizeString(m?.type, 'builtin');
            return {
              stepId,
              sourceId,
              name,
              type,
              builtin:
                typeof m?.builtin === 'string' && m.builtin.trim()
                  ? m.builtin.trim()
                  : null,
              allowOutOfBounds: this.normalizeBool(m?.allowOutOfBounds, false),
              position: this.normalizeVec3(m?.position, [0, 0, 0]),
              rotation: this.normalizeVec3(m?.rotation, [0, 0, 0]),
              scale: this.normalizeVec3(m?.scale, [1, 1, 1]),
            };
          })
          .filter(
            (x): x is {
              stepId: string;
              sourceId: number;
              name: string;
              type: string;
              builtin: string | null;
              allowOutOfBounds: boolean;
              position: [number, number, number];
              rotation: [number, number, number];
              scale: [number, number, number];
            } => x !== null,
          );
        tx.push(this.prisma.theaterModel.deleteMany({ where: { stepId } }));
        if (data.length) tx.push(this.prisma.theaterModel.createMany({ data }));
      }

      if (Array.isArray(theaterSpotlightsValue)) {
        const data = theaterSpotlightsValue
          .map((sp: any) => {
            const sourceId = this.normalizeInt(sp?.id, -1);
            if (sourceId <= 0) return null;
            const label = this.normalizeString(sp?.label, `Spotlight ${sourceId}`);
            return {
              stepId,
              sourceId,
              label,
              position: this.normalizeVec3(sp?.position, [0, 6, 6]),
              target: this.normalizeVec3(sp?.target, [0, 1, 2]),
              angleDeg: this.normalizeInt(sp?.angleDeg, 20),
              intensity: this.normalizeFloat(sp?.intensity, 0.7),
              color: this.normalizeString(sp?.color, '#ffffff'),
              enabled: this.normalizeBool(sp?.enabled, true),
              channel: this.normalizeInt(sp?.channel, sourceId),
              isRgb: this.normalizeBool(sp?.isRgb, false),
            };
          })
          .filter(
            (x): x is {
              stepId: string;
              sourceId: number;
              label: string;
              position: [number, number, number];
              target: [number, number, number];
              angleDeg: number;
              intensity: number;
              color: string;
              enabled: boolean;
              channel: number;
              isRgb: boolean;
            } => x !== null,
          );
        tx.push(this.prisma.theaterSpotlight.deleteMany({ where: { stepId } }));
        if (data.length) tx.push(this.prisma.theaterSpotlight.createMany({ data }));
      }

      if (tx.length) {
        await this.prisma.$transaction(tx);
      }
    } catch (err) {
      console.error('[sync] failed to sync nested Step payload', {
        stepId: payload?.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Проверка: пользователь — владелец или участник с ролью editor. */
  private async canUserWriteToProject(
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        members: { where: { userId }, select: { role: true } },
      },
    });
    if (!project) return false;
    if (project.ownerId === userId) return true;
    const membership = project.members[0];
    return membership?.role === 'editor';
  }

  /** Из change извлекаем projectId для проверки прав. */
  private async getProjectIdForChange(
    entityType: string,
    payload: any,
  ): Promise<string | null> {
    if (entityType === 'Project' && payload?.id) return payload.id;
    if (entityType === 'Scene' && payload?.projectId) return payload.projectId;
    if (
      (entityType === 'Step' ||
        entityType === 'PlaylistItem' ||
        entityType === 'Sound' ||
        entityType === 'GlobalLightChannel' ||
        entityType === 'TheaterLayout') &&
      payload?.sceneId
    ) {
      const scene = await this.prisma.scene.findUnique({
        where: { id: payload.sceneId },
        select: { projectId: true },
      });
      return scene?.projectId ?? null;
    }
    return null;
  }

  /** Возвращает снимок проектов, сцен и шагов. Если передан projectSlug — только по этому проекту. */
  async getChangesSince(
    userId: string,
    _lastSyncAt: string | null,
    projectSlug?: string,
    include?: {
      steps?: boolean;
      playlist?: boolean;
      sounds?: boolean;
      lightChannels?: boolean;
      theaterLayout?: boolean;
    },
  ) {
    const projectAccessWhere = {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    };

    const projectWhere = projectSlug
      ? { ...projectAccessWhere, slug: projectSlug }
      : projectAccessWhere;

    const projects = await this.prisma.project.findMany({
      where: projectWhere,
    });

    if (projects.length === 0) {
      const now = new Date().toISOString();
      return { now, projects: [], scenes: [], steps: [] };
    }

    const projectIds = projects.map((p) => p.id);

    const scenes = await this.prisma.scene.findMany({
      where: { projectId: { in: projectIds } },
    });

    const sceneIds = scenes.map((s) => s.id);

    const wantSteps = Boolean(include?.steps);
    const wantPlaylist = Boolean(include?.playlist);
    const wantSounds = Boolean(include?.sounds);
    const wantLightChannels = Boolean(include?.lightChannels);
    const wantTheaterLayout = Boolean(include?.theaterLayout);

    const stepsRaw = wantSteps
      ? await this.prisma.step.findMany({
          where: { sceneId: { in: sceneIds }, deletedAt: null },
          include: {
            requisites: true,
            lightPlot: true,
            theaterModels: true,
            theaterSpotlights: true,
          },
          orderBy: [{ sceneId: 'asc' }, { order: 'asc' }],
        })
      : [];

    // Дедуп шагов по (sceneId, sourceId).
    // Причина: ранее могли приехать Step с неконсистентным id (другая "префиксная" часть),
    // что приводило к двум строкам с одинаковым sourceId в одной сцене.
    const stepsByComposite = new Map<string, (typeof stepsRaw)[number]>();
    for (const st of stepsRaw) {
      const k = `${st.sceneId}:${st.sourceId}`;
      const prev = stepsByComposite.get(k);
      if (!prev) {
        stepsByComposite.set(k, st);
        continue;
      }
      // Берём "самый свежий" как источник истины
      if (st.updatedAt > prev.updatedAt) stepsByComposite.set(k, st);
    }
    const steps = Array.from(stepsByComposite.values()).sort((a, b) => {
      if (a.sceneId !== b.sceneId) return a.sceneId < b.sceneId ? -1 : 1;
      return a.order - b.order;
    });

    const stepsBySceneId = new Map<string, typeof steps>();
    for (const st of steps) {
      const list = stepsBySceneId.get(st.sceneId) ?? [];
      list.push(st);
      stepsBySceneId.set(st.sceneId, list);
    }

    const playlistItems = wantPlaylist
      ? await this.prisma.playlistItem.findMany({
          where: { sceneId: { in: sceneIds } },
          orderBy: [{ sceneId: 'asc' }, { order: 'asc' }],
        })
      : [];

    const sounds = wantSounds
      ? await this.prisma.sound.findMany({
          where: { sceneId: { in: sceneIds } },
          orderBy: [{ sceneId: 'asc' }, { sourceId: 'asc' }],
        })
      : [];

    const lightChannels = wantLightChannels
      ? await this.prisma.globalLightChannel.findMany({
          where: { sceneId: { in: sceneIds } },
          orderBy: [{ sceneId: 'asc' }, { index: 'asc' }],
        })
      : [];

    const theaterLayouts = wantTheaterLayout
      ? await this.prisma.theaterLayout.findMany({
          where: { sceneId: { in: sceneIds } },
        })
      : [];

    const now = new Date().toISOString();
    const scenesForClient = scenes;

    return {
      now,
      projects,
      scenes: scenesForClient,
      ...(wantSteps ? { steps } : {}),
      ...(wantPlaylist ? { playlistItems } : {}),
      ...(wantSounds ? { sounds } : {}),
      ...(wantLightChannels ? { lightChannels } : {}),
      ...(wantTheaterLayout ? { theaterLayouts } : {}),
    };
  }

  async getSceneSnapshot(
    userId: string,
    projectSlug: string,
    sceneName: string,
    include?: {
      steps?: boolean;
      playlist?: boolean;
      sounds?: boolean;
      lightChannels?: boolean;
      theaterLayout?: boolean;
    },
  ) {
    const slug = String(projectSlug ?? '').trim();
    const name = String(sceneName ?? '').trim();
    if (!slug) throw new NotFoundException('Project not found');
    if (!name) throw new NotFoundException('Scene not found');

    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        deletedAt: null,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true, slug: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const sceneId = `${project.id}:${name}`;
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
    });
    if (!scene) throw new NotFoundException('Scene not found');

    const wantSteps = Boolean(include?.steps);
    const wantPlaylist = Boolean(include?.playlist);
    const wantSounds = Boolean(include?.sounds);
    const wantLightChannels = Boolean(include?.lightChannels);
    const wantTheaterLayout = Boolean(include?.theaterLayout);

    const stepsRaw = wantSteps
      ? await this.prisma.step.findMany({
          where: { sceneId, deletedAt: null },
          include: {
            requisites: true,
            lightPlot: true,
            theaterModels: true,
            theaterSpotlights: true,
          },
          orderBy: { order: 'asc' },
        })
      : [];
    const stepsBySourceId = new Map<number, (typeof stepsRaw)[number]>();
    for (const st of stepsRaw) {
      const prev = stepsBySourceId.get(st.sourceId);
      if (!prev || st.updatedAt > prev.updatedAt) stepsBySourceId.set(st.sourceId, st);
    }
    const steps = Array.from(stepsBySourceId.values()).sort((a, b) => a.order - b.order);

    const playlistItems = wantPlaylist
      ? await this.prisma.playlistItem.findMany({
          where: { sceneId },
          orderBy: { order: 'asc' },
        })
      : [];
    const sounds = wantSounds
      ? await this.prisma.sound.findMany({
          where: { sceneId },
          orderBy: { sourceId: 'asc' },
        })
      : [];
    const lightChannels = wantLightChannels
      ? await this.prisma.globalLightChannel.findMany({
          where: { sceneId },
          orderBy: { index: 'asc' },
        })
      : [];
    const theaterLayout = wantTheaterLayout
      ? await this.prisma.theaterLayout.findUnique({
          where: { sceneId },
        })
      : null;

    return {
      scene: {
        id: scene.id,
        projectId: scene.projectId,
        name: scene.name,
        updatedAt: scene.updatedAt,
      },
      ...(wantSteps ? { steps } : {}),
      ...(wantPlaylist ? { playlistItems } : {}),
      ...(wantSounds ? { sounds } : {}),
      ...(wantLightChannels ? { lightChannels } : {}),
      ...(wantTheaterLayout ? { theaterLayout } : {}),
    };
  }

  // Временный метод для полной проверки содержимого таблиц Scene/Step без фильтров
  async debugAll() {
    const scenes = await this.prisma.scene.findMany();
    const steps = await this.prisma.step.findMany();
    return { scenes, steps };
  }
}
