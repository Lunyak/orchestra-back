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

  private pruneSceneRawJson(rawJson: any): any | null {
    if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) return null;
    const next: any = { ...(rawJson as any) };

    // Тяжёлые куски — уже нормализованы в таблицы.
    delete next.steps;
    delete next.lightChannels;
    delete next.theaterLayout;
    delete next.playlist;
    delete next.sounds;

    return next;
  }

  private async syncPlaylistFromRawJson(sceneId: string, rawJson: any) {
    const playlistValue = rawJson?.playlist;
    if (!Array.isArray(playlistValue)) return;

    const items = playlistValue
      .map((t: any, idx: number) => {
        const sourceId = this.normalizeInt(t?.id, -1);
        if (sourceId <= 0) return null;
        const title = this.normalizeString(t?.title, `Track ${sourceId}`);
        const file = this.normalizeString(t?.file, '');
        if (!file) return null;
        const fadeMs = this.normalizeInt(t?.fadeMs, 500);
        const loop = this.normalizeBool(t?.loop, false);
        const remoteUrl =
          typeof t?.remoteUrl === 'string' && t.remoteUrl.trim()
            ? t.remoteUrl.trim()
            : null;
        const remoteKey =
          typeof t?.remoteKey === 'string' && t.remoteKey.trim()
            ? t.remoteKey.trim()
            : null;

        return {
          sceneId,
          order: idx,
          sourceId,
          title,
          file,
          remoteUrl,
          remoteKey,
          fadeMs,
          loop,
        };
      })
      .filter(Boolean) as Array<{
      sceneId: string;
      order: number;
      sourceId: number;
      title: string;
      file: string;
      remoteUrl: string | null;
      remoteKey: string | null;
      fadeMs: number;
      loop: boolean;
    }>;

    await this.prisma.$transaction([
      this.prisma.playlistItem.deleteMany({ where: { sceneId } }),
      ...(items.length
        ? [
            this.prisma.playlistItem.createMany({
              data: items,
            }),
          ]
        : []),
    ]);
  }

  private async syncSoundsFromRawJson(sceneId: string, rawJson: any) {
    const soundsValue = rawJson?.sounds;
    if (!Array.isArray(soundsValue)) return;

    const rows = (soundsValue as any[])
      .map((s: any) => {
        const sourceId = this.normalizeInt(s?.id, -1);
        if (sourceId <= 0) return null;
        const title = this.normalizeString(s?.title, `Sound ${sourceId}`);
        const file = this.normalizeString(s?.file, '');
        if (!file) return null;
        const icon =
          typeof s?.icon === 'string' && s.icon.trim() ? s.icon.trim() : null;
        const volume = this.normalizeFloat(s?.volume, 0.8);
        const fadeMs = this.normalizeInt(s?.fadeMs, 500);
        const loop = this.normalizeBool(s?.loop, false);

        const remoteUrl =
          typeof s?.remoteUrl === 'string' && s.remoteUrl.trim()
            ? s.remoteUrl.trim()
            : null;
        const remoteKey =
          typeof s?.remoteKey === 'string' && s.remoteKey.trim()
            ? s.remoteKey.trim()
            : null;

        const iconRemoteUrl =
          typeof s?.iconRemoteUrl === 'string' && s.iconRemoteUrl.trim()
            ? s.iconRemoteUrl.trim()
            : null;
        const iconRemoteKey =
          typeof s?.iconRemoteKey === 'string' && s.iconRemoteKey.trim()
            ? s.iconRemoteKey.trim()
            : null;

        return {
          // делаем id стабильным, чтобы можно было безопасно перезаписывать запись
          id: `${sceneId}:sound:${sourceId}`,
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
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      sceneId: string;
      sourceId: number;
      title: string;
      file: string;
      icon: string | null;
      remoteUrl: string | null;
      remoteKey: string | null;
      iconRemoteUrl: string | null;
      iconRemoteKey: string | null;
      volume: number;
      fadeMs: number;
      loop: boolean;
    }>;

    await this.prisma.$transaction([
      this.prisma.sound.deleteMany({ where: { sceneId } }),
      ...(rows.length ? [this.prisma.sound.createMany({ data: rows })] : []),
    ]);
  }

  private async syncTheaterLayoutFromRawJson(sceneId: string, rawJson: any) {
    const v = rawJson?.theaterLayout;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return;

    // NOTE: в БД TheaterLayout содержит stage* поля, а на фронте тип TheaterLayout — без stage*.
    // Поэтому stage* берём из rawJson, если они есть, иначе используем безопасные дефолты.
    const data = {
      sceneId,
      hallWidth: this.normalizeInt((v as any).hallWidth, 9),
      hallDepth: this.normalizeInt((v as any).hallDepth, 6),
      wallHeight: this.normalizeInt((v as any).wallHeight, 6),
      stageWidth: this.normalizeInt((v as any).stageWidth, 6),
      stageDepth: this.normalizeInt((v as any).stageDepth, 4),
      stageHeight: this.normalizeInt((v as any).stageHeight, 1),
      stageZ: this.normalizeInt((v as any).stageZ, 0),
      audienceStartZ: this.normalizeInt((v as any).audienceStartZ, 3),
      seatRows: this.normalizeInt((v as any).seatRows, 4),
      seatsPerRow: this.normalizeInt((v as any).seatsPerRow, 7),
      seatSpacing: this.normalizeFloat((v as any).seatSpacing, 1.1),
      rowSpacing: this.normalizeFloat((v as any).rowSpacing, 0.8),
      aisleWidth: this.normalizeFloat((v as any).aisleWidth, 1.2),
      aisleCenterX: this.normalizeFloat((v as any).aisleCenterX, 0),
      doorWidth: this.normalizeFloat((v as any).doorWidth, 1.2),
      doorHeight: this.normalizeFloat((v as any).doorHeight, 2.2),
      doorZ: this.normalizeFloat((v as any).doorZ, -6),
      rowRise: this.normalizeFloat((v as any).rowRise, 0.25),
    };

    await this.prisma.theaterLayout.upsert({
      where: { sceneId },
      update: data,
      create: { ...data },
    });
  }

  private async syncLightChannelsFromRawJson(sceneId: string, rawJson: any) {
    const value = rawJson?.lightChannels;
    if (!Array.isArray(value)) return;

    const rows = value
      .map((raw: any, index: number) => ({
        sceneId,
        index,
        raw: this.normalizeString(raw, ''),
      }))
      .filter((x) => x.raw);

    await this.prisma.$transaction([
      this.prisma.globalLightChannel.deleteMany({ where: { sceneId } }),
      ...(rows.length
        ? [
            this.prisma.globalLightChannel.createMany({
              data: rows,
            }),
          ]
        : []),
    ]);
  }

  private async syncStepsFromRawJson(sceneId: string, rawJson: any) {
    const stepsValue = rawJson?.steps;
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

    // Upsert steps + overwrite nested свет/3D данные из rawJson (локально rawJson остаётся как источник истины на фронте).
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

  /** Собрать все ключи файлов из rawJson сцены (sounds, playlist). */
  private collectFileKeysFromScene(
    rawJson: any,
    projectId: string,
  ): Set<string> {
    const keys = new Set<string>();
    if (!rawJson || typeof rawJson !== 'object') return keys;

    const push = (v: string) => {
      const key = this.fileValueToStorageKey(v, projectId);
      if (key) keys.add(key);
    };

    const sounds = rawJson.sounds;
    if (Array.isArray(sounds)) {
      sounds.forEach((s: any) => {
        if (s?.file) push(String(s.file));
        if (s?.remoteKey) push(String(s.remoteKey));
        if (s?.icon) push(String(s.icon));
        if (s?.iconRemoteKey) push(String(s.iconRemoteKey));
      });
    }

    const playlist = rawJson.playlist;
    if (Array.isArray(playlist)) {
      playlist.forEach((p: any) => {
        if (p?.file) push(String(p.file));
        if (p?.remoteKey) push(String(p.remoteKey));
      });
    }

    const images = rawJson.images;
    if (images && typeof images === 'object' && !Array.isArray(images)) {
      Object.values(images).forEach((img: any) => {
        if (img?.remoteKey) push(String(img.remoteKey));
      });
    }

    return keys;
  }

  private async collectFileKeysFromSceneDb(
    sceneId: string,
    projectId: string,
    existingRawJson: any,
  ): Promise<Set<string>> {
    const keys = new Set<string>();
    const push = (v: string) => {
      const key = this.fileValueToStorageKey(v, projectId);
      if (key) keys.add(key);
    };

    const sounds = await this.prisma.sound.findMany({
      where: { sceneId },
      select: { remoteKey: true, iconRemoteKey: true, file: true, icon: true },
    });
    sounds.forEach((s) => {
      if (s.remoteKey) push(String(s.remoteKey));
      if (s.iconRemoteKey) push(String(s.iconRemoteKey));
      // на всякий случай поддерживаем старые "file" значения, если они были ключами
      if (s.file) push(String(s.file));
      if (s.icon) push(String(s.icon));
    });

    const playlist = await this.prisma.playlistItem.findMany({
      where: { sceneId },
      select: { remoteKey: true, file: true },
    });
    playlist.forEach((p) => {
      if (p.remoteKey) push(String(p.remoteKey));
      if (p.file) push(String(p.file));
    });

    // images пока остаются в rawJson (но при prune остаются тоже),
    // поэтому ключи берём из существующего rawJson.
    const images = existingRawJson?.images;
    if (images && typeof images === 'object' && !Array.isArray(images)) {
      Object.values(images).forEach((img: any) => {
        if (img?.remoteKey) push(String(img.remoteKey));
      });
    }

    return keys;
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

    const projectId = payload?.projectId;
    if (projectId && operation === 'update' && payload?.rawJson) {
      const existing = await this.prisma.scene.findUnique({
        where: { id: payload.id },
        select: { rawJson: true },
      });
      const oldKeys = await this.collectFileKeysFromSceneDb(
        payload.id,
        projectId,
        existing?.rawJson ?? null,
      );
      const newKeys = this.collectFileKeysFromScene(payload.rawJson, projectId);
      const toDelete = [...oldKeys].filter((k) => !newKeys.has(k));

      // Дополнительное логирование для отладки
      if (toDelete.length > 0) {
        console.log('[sync] detected unused files', {
          sceneId: payload.id,
          oldKeysCount: oldKeys.size,
          newKeysCount: newKeys.size,
          toDeleteCount: toDelete.length,
          oldKeys: [...oldKeys],
          newKeys: [...newKeys],
          toDelete,
        });
      }

      const storage = this.getFileStorage();
      for (const key of toDelete) {
        await storage.deleteObject(key);
      }
      if (toDelete.length > 0) {
        console.log('[sync] deleted unused files from storage', {
          count: toDelete.length,
          keys: toDelete,
        });
      }
    }

    console.log('[sync] applying Scene change', {
      operation,
      id: payload.id,
      projectId: payload.projectId,
      name: payload.name,
    });

    const rawJsonToStore = payload?.rawJson
      ? this.pruneSceneRawJson(payload.rawJson)
      : null;

    const result = await this.prisma.scene.upsert({
      where: { id: payload.id },
      update: {
        name: payload.name,
        rawJson: rawJsonToStore,
      },
      create: {
        id: payload.id,
        name: payload.name,
        rawJson: rawJsonToStore,
        projectId: payload.projectId,
      },
    });

    // ВАЖНО: раньше playlist хранился только в rawJson и таблица PlaylistItem оставалась пустой.
    // Теперь дополнительно нормализуем playlist в отдельную таблицу, чтобы его можно было читать через include.
    if (payload?.rawJson) {
      try {
        await this.syncPlaylistFromRawJson(result.id, payload.rawJson);
      } catch (err) {
        console.error('[sync] failed to sync playlist items from rawJson', {
          sceneId: result.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (payload?.rawJson) {
      try {
        await this.syncSoundsFromRawJson(result.id, payload.rawJson);
      } catch (err) {
        console.error('[sync] failed to sync sounds from rawJson', {
          sceneId: result.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Следующий шаг нормализации: шаги + свет/3D театр (из rawJson).
    if (payload?.rawJson) {
      try {
        await this.syncStepsFromRawJson(result.id, payload.rawJson);
      } catch (err) {
        console.error('[sync] failed to sync steps from rawJson', {
          sceneId: result.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      try {
        await this.syncLightChannelsFromRawJson(result.id, payload.rawJson);
      } catch (err) {
        console.error('[sync] failed to sync lightChannels from rawJson', {
          sceneId: result.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      try {
        await this.syncTheaterLayoutFromRawJson(result.id, payload.rawJson);
      } catch (err) {
        console.error('[sync] failed to sync theaterLayout from rawJson', {
          sceneId: result.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    console.log('[sync] Scene upsert result', {
      id: result.id,
      name: result.name,
    });

    if (payload.projectId) {
      this.notifications.notifySceneUpdated(payload.projectId);
    }
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
    if (entityType === 'Step' && payload?.sceneId) {
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

    // IMPORTANT:
    // Scene.rawJson хранит только "лёгкие" поля (metadata).
    // Полный "офлайн JSON" собираем обратно из нормализованных таблиц,
    // чтобы desktop/web могли работать как раньше после syncPull.

    const steps = await this.prisma.step.findMany({
      where: { sceneId: { in: sceneIds }, deletedAt: null },
      include: {
        requisites: true,
        lightPlot: true,
        theaterModels: true,
        theaterSpotlights: true,
      },
      orderBy: [{ sceneId: 'asc' }, { order: 'asc' }],
    });

    const stepsBySceneId = new Map<string, typeof steps>();
    for (const st of steps) {
      const list = stepsBySceneId.get(st.sceneId) ?? [];
      list.push(st);
      stepsBySceneId.set(st.sceneId, list);
    }

    const playlistItems = await this.prisma.playlistItem.findMany({
      where: { sceneId: { in: sceneIds } },
      orderBy: [{ sceneId: 'asc' }, { order: 'asc' }],
    });
    const playlistBySceneId = new Map<string, typeof playlistItems>();
    for (const p of playlistItems) {
      const list = playlistBySceneId.get(p.sceneId) ?? [];
      list.push(p);
      playlistBySceneId.set(p.sceneId, list);
    }

    const sounds = await this.prisma.sound.findMany({
      where: { sceneId: { in: sceneIds } },
      orderBy: [{ sceneId: 'asc' }, { sourceId: 'asc' }],
    });
    const soundsBySceneId = new Map<string, typeof sounds>();
    for (const s of sounds) {
      const list = soundsBySceneId.get(s.sceneId) ?? [];
      list.push(s);
      soundsBySceneId.set(s.sceneId, list);
    }

    const lightChannels = await this.prisma.globalLightChannel.findMany({
      where: { sceneId: { in: sceneIds } },
      orderBy: [{ sceneId: 'asc' }, { index: 'asc' }],
    });
    const lightChannelsBySceneId = new Map<string, typeof lightChannels>();
    for (const ch of lightChannels) {
      const list = lightChannelsBySceneId.get(ch.sceneId) ?? [];
      list.push(ch);
      lightChannelsBySceneId.set(ch.sceneId, list);
    }

    const layouts = await this.prisma.theaterLayout.findMany({
      where: { sceneId: { in: sceneIds } },
    });
    const layoutBySceneId = new Map<string, (typeof layouts)[number]>();
    for (const l of layouts) layoutBySceneId.set(l.sceneId, l);

    const scenesWithRehydratedRawJson = scenes.map((scene) => {
      const legacy =
        scene.rawJson && typeof scene.rawJson === 'object' && !Array.isArray(scene.rawJson)
          ? (scene.rawJson as any)
          : {};

      const stepRows = stepsBySceneId.get(scene.id) ?? [];
      const rehydratedSteps = stepRows.map((st) => ({
        id: st.sourceId,
        title: st.title,
        markdown: st.markdown ?? '',
        playMarkdown: st.playMarkdown ?? undefined,
        durationMin: st.durationMin ?? undefined,
        kanbanStatus: st.kanbanStatus ?? undefined,
        kanbanOrder: st.kanbanOrder ?? undefined,
        cast: (st.cast as any) ?? undefined,
        requisites: (st.requisites ?? []).map((r) => ({
          id: r.sourceId,
          label: r.label,
          checked: r.checked,
        })),
        lightPlot: (st.lightPlot ?? []).map((f) => ({
          id: f.sourceId,
          label: f.label,
          channel: f.channel ?? '',
          x: f.x,
          y: f.y,
          angle: f.angle,
          length: f.length,
        })),
        theaterModels: (st.theaterModels ?? []).map((m) => ({
          id: m.sourceId,
          name: m.name,
          type: m.type,
          builtin: m.builtin ?? undefined,
          allowOutOfBounds: m.allowOutOfBounds,
          position: m.position,
          rotation: m.rotation,
          scale: m.scale,
        })),
        theaterSpotlights: (st.theaterSpotlights ?? []).map((sp) => ({
          id: sp.sourceId,
          label: sp.label,
          position: sp.position,
          target: sp.target,
          angleDeg: sp.angleDeg,
          intensity: sp.intensity,
          color: sp.color,
          enabled: sp.enabled,
          channel: sp.channel,
          isRgb: sp.isRgb,
        })),
      }));

      const pl = playlistBySceneId.get(scene.id) ?? [];
      const rehydratedPlaylist = pl.map((p) => ({
        id: p.sourceId,
        title: p.title,
        file: p.file,
        fadeMs: p.fadeMs,
        loop: p.loop,
        remoteUrl: (p as any).remoteUrl ?? undefined,
        remoteKey: (p as any).remoteKey ?? undefined,
      }));

      const snd = soundsBySceneId.get(scene.id) ?? [];
      const rehydratedSounds = snd.map((s) => ({
        id: s.sourceId,
        title: s.title,
        file: s.file,
        icon: s.icon ?? undefined,
        volume: s.volume,
        fadeMs: s.fadeMs,
        loop: s.loop,
        remoteUrl: s.remoteUrl ?? undefined,
        remoteKey: s.remoteKey ?? undefined,
        iconRemoteUrl: s.iconRemoteUrl ?? undefined,
        iconRemoteKey: s.iconRemoteKey ?? undefined,
      }));

      const ch = lightChannelsBySceneId.get(scene.id) ?? [];
      const rehydratedLightChannels = ch.map((x) => x.raw);

      const layout = layoutBySceneId.get(scene.id);
      const rehydratedTheaterLayout = layout
        ? {
            hallWidth: layout.hallWidth,
            hallDepth: layout.hallDepth,
            wallHeight: layout.wallHeight,
            stageWidth: layout.stageWidth,
            stageDepth: layout.stageDepth,
            stageHeight: layout.stageHeight,
            stageZ: layout.stageZ,
            audienceStartZ: layout.audienceStartZ,
            seatRows: layout.seatRows,
            seatsPerRow: layout.seatsPerRow,
            seatSpacing: layout.seatSpacing,
            rowSpacing: layout.rowSpacing,
            aisleWidth: layout.aisleWidth,
            aisleCenterX: layout.aisleCenterX,
            doorWidth: layout.doorWidth,
            doorHeight: layout.doorHeight,
            doorZ: layout.doorZ,
            rowRise: layout.rowRise,
          }
        : undefined;

      return {
        ...scene,
        rawJson: {
          ...legacy,
          name: legacy?.name ?? scene.name,
          steps: rehydratedSteps,
          playlist: rehydratedPlaylist,
          sounds: rehydratedSounds,
          lightChannels: rehydratedLightChannels,
          theaterLayout: rehydratedTheaterLayout,
        },
      };
    });

    const now = new Date().toISOString();

    return {
      now,
      projects,
      scenes: scenesWithRehydratedRawJson,
      steps,
    };
  }

  async getSceneSnapshot(userId: string, projectSlug: string, sceneName: string) {
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

    const steps = await this.prisma.step.findMany({
      where: { sceneId, deletedAt: null },
      include: {
        requisites: true,
        lightPlot: true,
        theaterModels: true,
        theaterSpotlights: true,
      },
      orderBy: { order: 'asc' },
    });

    const playlist = await this.prisma.playlistItem.findMany({
      where: { sceneId },
      orderBy: { order: 'asc' },
    });

    const sounds = await this.prisma.sound.findMany({
      where: { sceneId },
      orderBy: { sourceId: 'asc' },
    });

    const lightChannels = await this.prisma.globalLightChannel.findMany({
      where: { sceneId },
      orderBy: { index: 'asc' },
    });

    const layout = await this.prisma.theaterLayout.findUnique({
      where: { sceneId },
    });

    const legacy =
      scene.rawJson && typeof scene.rawJson === 'object' && !Array.isArray(scene.rawJson)
        ? (scene.rawJson as any)
        : {};

    const rawJson = {
      ...legacy,
      name: legacy?.name ?? scene.name,
      steps: steps.map((st) => ({
        id: st.sourceId,
        title: st.title,
        markdown: st.markdown ?? '',
        playMarkdown: st.playMarkdown ?? undefined,
        durationMin: st.durationMin ?? undefined,
        kanbanStatus: st.kanbanStatus ?? undefined,
        kanbanOrder: st.kanbanOrder ?? undefined,
        cast: (st.cast as any) ?? undefined,
        requisites: (st.requisites ?? []).map((r) => ({
          id: r.sourceId,
          label: r.label,
          checked: r.checked,
        })),
        lightPlot: (st.lightPlot ?? []).map((f) => ({
          id: f.sourceId,
          label: f.label,
          channel: f.channel ?? '',
          x: f.x,
          y: f.y,
          angle: f.angle,
          length: f.length,
        })),
        theaterModels: (st.theaterModels ?? []).map((m) => ({
          id: m.sourceId,
          name: m.name,
          type: m.type,
          builtin: m.builtin ?? undefined,
          allowOutOfBounds: m.allowOutOfBounds,
          position: m.position,
          rotation: m.rotation,
          scale: m.scale,
        })),
        theaterSpotlights: (st.theaterSpotlights ?? []).map((sp) => ({
          id: sp.sourceId,
          label: sp.label,
          position: sp.position,
          target: sp.target,
          angleDeg: sp.angleDeg,
          intensity: sp.intensity,
          color: sp.color,
          enabled: sp.enabled,
          channel: sp.channel,
          isRgb: sp.isRgb,
        })),
      })),
      playlist: playlist.map((p) => ({
        id: p.sourceId,
        title: p.title,
        file: p.file,
        fadeMs: p.fadeMs,
        loop: p.loop,
        remoteUrl: (p as any).remoteUrl ?? undefined,
        remoteKey: (p as any).remoteKey ?? undefined,
      })),
      sounds: sounds.map((s) => ({
        id: s.sourceId,
        title: s.title,
        file: s.file,
        icon: s.icon ?? undefined,
        volume: s.volume,
        fadeMs: s.fadeMs,
        loop: s.loop,
        remoteUrl: s.remoteUrl ?? undefined,
        remoteKey: s.remoteKey ?? undefined,
        iconRemoteUrl: s.iconRemoteUrl ?? undefined,
        iconRemoteKey: s.iconRemoteKey ?? undefined,
      })),
      lightChannels: lightChannels.map((x) => x.raw),
      theaterLayout: layout
        ? {
            hallWidth: layout.hallWidth,
            hallDepth: layout.hallDepth,
            wallHeight: layout.wallHeight,
            stageWidth: layout.stageWidth,
            stageDepth: layout.stageDepth,
            stageHeight: layout.stageHeight,
            stageZ: layout.stageZ,
            audienceStartZ: layout.audienceStartZ,
            seatRows: layout.seatRows,
            seatsPerRow: layout.seatsPerRow,
            seatSpacing: layout.seatSpacing,
            rowSpacing: layout.rowSpacing,
            aisleWidth: layout.aisleWidth,
            aisleCenterX: layout.aisleCenterX,
            doorWidth: layout.doorWidth,
            doorHeight: layout.doorHeight,
            doorZ: layout.doorZ,
            rowRise: layout.rowRise,
          }
        : undefined,
    };

    return {
      scene: {
        id: scene.id,
        projectId: scene.projectId,
        name: scene.name,
        rawJson,
        updatedAt: scene.updatedAt,
      },
    };
  }

  // Временный метод для полной проверки содержимого таблиц Scene/Step без фильтров
  async debugAll() {
    const scenes = await this.prisma.scene.findMany();
    const steps = await this.prisma.step.findMany();
    return { scenes, steps };
  }
}
