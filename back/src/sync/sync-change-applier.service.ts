import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PrismaService } from '../prisma/prisma.service';
import {
  clientTheaterModelToPrisma,
  flattenClientTheaterModels,
} from './theater-model-sync';
import {
  syncMapTheaterSpotlightRow,
  syncNormalizeBool,
  syncNormalizeFloat,
  syncNormalizeInt,
  syncNormalizeString,
  syncNormalizeVec3,
  syncProjectIdFromCompoundId,
} from './sync-value-normalize';

@Injectable()
export class SyncChangeApplierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsGateway,
  ) {}

  private hasJsonValue(value: unknown): boolean {
    if (value == null) return false;
    if (typeof value === 'object') {
      return Object.keys(value as object).length > 0;
    }
    return true;
  }
  async applyProjectChange(
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
  async applyPlaybookChange(
    userId: string,
    operation: string,
    payload: any,
    sourceClientId?: string | null,
    allowNullWipe = false,
  ) {
    if (operation === 'delete') {
      await this.prisma.playbook.updateMany({ where: { id: payload.id, project: { ownerId: userId },
        },
        data: { deletedAt: new Date(payload.updatedAt) },
      });
      return;
    }

    console.log('[sync] applying Playbook change', {
      operation,
      id: payload.id,
      projectId: payload.projectId,
      name: payload.name,
    });

    const hasSceneRoles = Object.prototype.hasOwnProperty.call(
      payload ?? {},
      'sceneRoles',
    );
    const nextSceneRoles = hasSceneRoles
      ? (payload?.sceneRoles ?? null)
      : undefined;
    const hasLightFaders = Object.prototype.hasOwnProperty.call(
      payload ?? {},
      'lightFaders',
    );
    const nextLightFaders = hasLightFaders
      ? (payload?.lightFaders ?? null)
      : undefined;
    const hasLightPrograms = Object.prototype.hasOwnProperty.call(
      payload ?? {},
      'lightPrograms',
    );
    const nextLightPrograms = hasLightPrograms
      ? (payload?.lightPrograms ?? null)
      : undefined;
    const hasLightChannelRoles = Object.prototype.hasOwnProperty.call(
      payload ?? {},
      'lightChannelRoles',
    );
    const nextLightChannelRoles = hasLightChannelRoles
      ? (payload?.lightChannelRoles ?? null)
      : undefined;
    const hasProjectorMedia = Object.prototype.hasOwnProperty.call(
      payload ?? {},
      'projectorMedia',
    );
    const nextProjectorMedia = hasProjectorMedia
      ? (payload?.projectorMedia ?? null)
      : undefined;

    const existing = await this.prisma.playbook.findUnique({ where: { id: payload.id }, select: { sceneRoles: true,
        lightFaders: true,
        lightPrograms: true,
        lightChannelRoles: true,
        projectorMedia: true,
      },
    });

    const keepExistingJson = (
      hasField: boolean,
      nextValue: unknown,
      currentValue: unknown,
      fieldName: string,
    ): boolean => {
      if (!hasField) return false;
      if (nextValue != null) return true;
      if (!this.hasJsonValue(currentValue)) return true;
      if (allowNullWipe) return true;
      console.warn('[sync] blocked null overwrite of Playbook field', {
        playbookId: payload.id,
        fieldName,
      });
      return false;
    };

    const applySceneRoles = keepExistingJson(
      hasSceneRoles,
      nextSceneRoles,
      existing?.sceneRoles,
      'sceneRoles',
    );
    const applyLightFaders = keepExistingJson(
      hasLightFaders,
      nextLightFaders,
      existing?.lightFaders,
      'lightFaders',
    );
    const applyLightPrograms = keepExistingJson(
      hasLightPrograms,
      nextLightPrograms,
      existing?.lightPrograms,
      'lightPrograms',
    );
    const applyLightChannelRoles = keepExistingJson(
      hasLightChannelRoles,
      nextLightChannelRoles,
      existing?.lightChannelRoles,
      'lightChannelRoles',
    );
    const applyProjectorMedia = keepExistingJson(
      hasProjectorMedia,
      nextProjectorMedia,
      existing?.projectorMedia,
      'projectorMedia',
    );

    const result = await this.prisma.playbook.upsert({ where: { id: payload.id }, update: { name: payload.name,
        ...(applySceneRoles ? { sceneRoles: nextSceneRoles } : {}),
        ...(applyLightFaders ? { lightFaders: nextLightFaders } : {}),
        ...(applyLightPrograms ? { lightPrograms: nextLightPrograms } : {}),
        ...(applyLightChannelRoles
          ? { lightChannelRoles: nextLightChannelRoles }
          : {}),
        ...(applyProjectorMedia ? { projectorMedia: nextProjectorMedia } : {}),
      },
      create: {
        id: payload.id,
        name: payload.name,
        projectId: payload.projectId,
        sceneRoles: hasSceneRoles ? nextSceneRoles : null,
        lightFaders: hasLightFaders ? nextLightFaders : null,
        lightPrograms: hasLightPrograms ? nextLightPrograms : null,
        lightChannelRoles: hasLightChannelRoles ? nextLightChannelRoles : null,
        projectorMedia: hasProjectorMedia ? nextProjectorMedia : null,
      },
    });

    console.log('[sync] Playbook upsert result', {
      id: result.id,
      name: result.name,
    });

    if (payload.projectId) {
      this.notifications.notifySceneUpdated(payload.projectId, sourceClientId);
    }
  }
  async applyPlaylistItemChange(
    operation: string,
    payload: any,
    sourceClientId?: string | null,
  ) {
    const playbookId = String(payload?.playbookId ?? payload?.sceneId ?? '').trim();
    const sourceId = syncNormalizeInt(payload?.sourceId, -1);
    if (!playbookId || sourceId <= 0) return;
    const projectId = syncProjectIdFromCompoundId(playbookId);

    if (operation === 'delete') {
      await this.prisma.playlistItem.deleteMany({
        where: { playbookId, sourceId },
      });
      if (projectId) this.notifications.notifySceneUpdated(projectId, sourceClientId);
      return;
    }

    const order = syncNormalizeInt(payload?.order, 0);
    const title = syncNormalizeString(payload?.title, `Track ${sourceId}`);
    const file = syncNormalizeString(payload?.file, '');

    const fadeMs = syncNormalizeInt(payload?.fadeMs, 0);
    const loop = syncNormalizeBool(payload?.loop, false);
    const remoteUrl =
      typeof payload?.remoteUrl === 'string' && payload.remoteUrl.trim()
        ? payload.remoteUrl.trim()
        : null;
    const remoteKey =
      typeof payload?.remoteKey === 'string' && payload.remoteKey.trim()
        ? payload.remoteKey.trim()
        : null;

    const existing = await this.prisma.playlistItem.findFirst({
      where: { playbookId, sourceId },
      select: { id: true },
    });
    if (existing?.id) {
      await this.prisma.playlistItem.update({
        where: { id: existing.id },
        data: { order, title, file, fadeMs, loop, remoteUrl, remoteKey },
      });
      if (projectId) this.notifications.notifySceneUpdated(projectId, sourceClientId);
      return;
    }
    await this.prisma.playlistItem.create({
      data: {
        playbookId,
          sourceId,
        order,
        title,
        file,
        fadeMs,
        loop,
        remoteUrl,
        remoteKey,
      },
    });
    if (projectId) this.notifications.notifySceneUpdated(projectId, sourceClientId);
  }
  async applySoundChange(
    operation: string,
    payload: any,
    sourceClientId?: string | null,
  ) {
    const playbookId = String(payload?.playbookId ?? payload?.sceneId ?? '').trim();
    const sourceId = syncNormalizeInt(payload?.sourceId, -1);
    if (!playbookId || sourceId <= 0) return;
    const projectId = syncProjectIdFromCompoundId(playbookId);

    if (operation === 'delete') {
      await this.prisma.sound.deleteMany({
        where: { playbookId, sourceId },
      });
      if (projectId) this.notifications.notifySceneUpdated(projectId, sourceClientId);
      return;
    }

    const title = syncNormalizeString(payload?.title, `Sound ${sourceId}`);
    const file = syncNormalizeString(payload?.file, '');
    const icon =
      typeof payload?.icon === 'string' && payload.icon.trim()
        ? payload.icon.trim()
        : null;
    const volume =
      payload?.volume != null && Number.isFinite(Number(payload.volume))
        ? Number(payload.volume)
        : 1;
    const fadeMs = syncNormalizeInt(payload?.fadeMs, 0);
    const loop = syncNormalizeBool(payload?.loop, false);
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
      where: { playbookId, sourceId },
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
      if (projectId) this.notifications.notifySceneUpdated(projectId, sourceClientId);
      return;
    }
    await this.prisma.sound.create({
      data: {
        playbookId,
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
    if (projectId) this.notifications.notifySceneUpdated(projectId, sourceClientId);
  }
  async applyGlobalLightChannelChange(
    operation: string,
    payload: any,
    sourceClientId?: string | null,
  ) {
    const playbookId = String(payload?.playbookId ?? payload?.sceneId ?? '').trim();
    const index = syncNormalizeInt(payload?.index, -1);
    if (!playbookId || index < 0) return;
    const projectId = syncProjectIdFromCompoundId(playbookId);

    if (operation === 'delete') {
      await this.prisma.globalLightChannel.deleteMany({
        where: { playbookId, index },
      });
      if (projectId) this.notifications.notifySceneUpdated(projectId, sourceClientId);
      return;
    }

    const raw = syncNormalizeString(payload?.raw, '');
    const updated = await this.prisma.globalLightChannel.updateMany({
      where: { playbookId, index },
      data: { raw, index },
    });
    if (updated.count > 0) return;
    await this.prisma.globalLightChannel.create({
      data: { playbookId, index, raw },
    });
    if (projectId) this.notifications.notifySceneUpdated(projectId, sourceClientId);
  }
  private buildTheaterLayoutExtras(payload: any): Prisma.InputJsonValue | undefined {
    const keys = [
      'stageShape',
      'stageFrontZ',
      'stageBackWidth',
      'prosceniumWidth',
      'prosceniumHeight',
      'prosceniumEnabled',
      'tJunctionZ',
      'wallRecesses',
      'stageOutline',
      'stageOutlineOpenEdges',
      'zones',
      'zoneGrid',
      'stageFloorMaterial',
      'hallFloorMaterial',
      'backWallMaterial',
      'sideWallsMaterial',
      'portalMaterial',
    ];
    const extras: Record<string, unknown> = {};
    for (const key of keys) {
      if (payload?.[key] !== undefined) extras[key] = payload[key];
    }
    return Object.keys(extras).length > 0
      ? (extras as Prisma.InputJsonObject)
      : undefined;
  }
  async applyTheaterLayoutChange(
    operation: string,
    payload: any,
    sourceClientId?: string | null,
  ) {
    const playbookId = String(payload?.playbookId ?? payload?.sceneId ?? '').trim();
    if (!playbookId) return;
    const projectId = syncProjectIdFromCompoundId(playbookId);
    if (operation === 'delete') {
      await this.prisma.theaterLayout.deleteMany({ where: { playbookId } });
      if (projectId) this.notifications.notifySceneUpdated(projectId, sourceClientId);
      return;
    }
    const num = (v: any, fallback: number) =>
      v != null && Number.isFinite(Number(v)) ? Number(v) : fallback;
    const optionalNum = (v: any) =>
      v != null && Number.isFinite(Number(v)) ? Number(v) : undefined;
    const optionalPositiveNum = (v: any) => {
      const value = optionalNum(v);
      return value != null && value > 0 ? value : undefined;
    };
    const optionalInt = (v: any) =>
      v != null && Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : undefined;
    const extras = this.buildTheaterLayoutExtras(payload);
    await this.prisma.theaterLayout.upsert({
      where: { playbookId },
      update: {
        hallWidth: optionalPositiveNum(payload?.hallWidth),
        hallDepth: optionalPositiveNum(payload?.hallDepth),
        wallHeight: optionalPositiveNum(payload?.wallHeight),
        stageWidth: optionalNum(payload?.stageWidth),
        stageDepth: optionalNum(payload?.stageDepth),
        stageHeight: optionalNum(payload?.stageHeight),
        stageZ: optionalNum(payload?.stageZ),
        audienceStartZ: optionalNum(payload?.audienceStartZ),
        seatRows: optionalInt(payload?.seatRows),
        seatsPerRow: optionalInt(payload?.seatsPerRow),
        seatSpacing: optionalNum(payload?.seatSpacing),
        rowSpacing: optionalNum(payload?.rowSpacing),
        rowRise: optionalNum(payload?.rowRise),
        aisleWidth: optionalNum(payload?.aisleWidth),
        aisleCenterX: optionalNum(payload?.aisleCenterX),
        doorWidth: optionalNum(payload?.doorWidth),
        doorHeight: optionalNum(payload?.doorHeight),
        doorZ: optionalNum(payload?.doorZ),
        doors: Array.isArray(payload?.doors) ? payload.doors : undefined,
        extras,
      },
      create: {
        playbookId,
        hallWidth: optionalPositiveNum(payload?.hallWidth) ?? 12,
        hallDepth: optionalPositiveNum(payload?.hallDepth) ?? 10,
        wallHeight: optionalPositiveNum(payload?.wallHeight) ?? 4,
        stageWidth: num(payload?.stageWidth, 0),
        stageDepth: num(payload?.stageDepth, 0),
        stageHeight: num(payload?.stageHeight, 0),
        stageZ: num(payload?.stageZ, 0),
        audienceStartZ: num(payload?.audienceStartZ, 0),
        seatRows: syncNormalizeInt(payload?.seatRows, 0),
        seatsPerRow: syncNormalizeInt(payload?.seatsPerRow, 0),
        seatSpacing: num(payload?.seatSpacing, 0),
        rowSpacing: num(payload?.rowSpacing, 0),
        rowRise: num(payload?.rowRise, 0),
        aisleWidth: num(payload?.aisleWidth, 0),
        aisleCenterX: num(payload?.aisleCenterX, 0),
        doorWidth: num(payload?.doorWidth, 0),
        doorHeight: num(payload?.doorHeight, 0),
        doorZ: num(payload?.doorZ, 0),
        doors: Array.isArray(payload?.doors) ? payload.doors : undefined,
        extras,
      },
    });
    if (projectId) this.notifications.notifySceneUpdated(projectId, sourceClientId);
  }
  async applySceneChange(
    userId: string,
    operation: string,
    payload: any,
    sourceClientId?: string | null,
  ) {
    const playbookId = String(payload?.playbookId ?? payload?.sceneId ?? '').trim();
    if (playbookId && !payload?.playbookId) {
      payload = { ...payload, playbookId };
    }

    if (operation === 'delete') {
      await this.prisma.scene.updateMany({
        where: {
          id: payload.id,
          playbook: { project: { ownerId: userId } },
        },
        data: { deletedAt: new Date(payload.updatedAt) },
      });
      const projectId = syncProjectIdFromCompoundId(payload?.id);
      if (projectId) this.notifications.notifySceneUpdated(projectId, sourceClientId);
      return;
    }

    console.log('[sync] applying Scene change', {
      operation,
      id: payload.id,
      playbookId: payload.playbookId,
      sourceId: payload.sourceId,
      title: payload.title,
    });

    // Проверяем, существует ли Playbook перед созданием Scene
    const playbookExists = await this.prisma.playbook.findUnique({ where: { id: payload.playbookId },
    });

    if (!playbookExists) {
      console.warn('[sync] Playbook does not exist for Scene', {
        sceneId: payload.id,
        playbookId: payload.playbookId,
      });
    }

    const hasLightKadrs = Object.prototype.hasOwnProperty.call(
      payload ?? {},
      'lightKadrs',
    );
    const nextLightKadrs = hasLightKadrs
      ? (payload?.lightKadrs ?? null)
      : undefined;

    const result = await this.prisma.scene.upsert({
      where: { id: payload.id },
      update: {
        title: payload.title,
        markdown: payload.markdown ?? null,
        playMarkdown: payload.playMarkdown ?? null,
        explicationMarkdown: payload.explicationMarkdown ?? null,
        // Если шаг ранее "удалили" (soft delete), любая upsert/update должна возвращать его в активное состояние.
        deletedAt: null,
        durationMin:
          payload.durationMin != null &&
          Number.isFinite(Number(payload.durationMin))
            ? Math.trunc(Number(payload.durationMin))
            : undefined,
        kanbanStatus:
          typeof payload.kanbanStatus === 'string' &&
          payload.kanbanStatus.trim()
            ? payload.kanbanStatus.trim()
            : undefined,
        kanbanOrder:
          payload.kanbanOrder != null &&
          Number.isFinite(Number(payload.kanbanOrder))
            ? Math.trunc(Number(payload.kanbanOrder))
            : undefined,
        order: payload.order,
        ...(hasLightKadrs ? { lightKadrs: nextLightKadrs } : {}),
      },
      create: {
        id: payload.id,
        playbookId: payload.playbookId,
        sourceId: payload.sourceId,
        title: payload.title,
        markdown: payload.markdown ?? null,
        playMarkdown: payload.playMarkdown ?? null,
        explicationMarkdown: payload.explicationMarkdown ?? null,
        deletedAt: null,
        durationMin:
          payload.durationMin != null &&
          Number.isFinite(Number(payload.durationMin))
            ? Math.trunc(Number(payload.durationMin))
            : null,
        kanbanStatus:
          typeof payload.kanbanStatus === 'string' &&
          payload.kanbanStatus.trim()
            ? payload.kanbanStatus.trim()
            : null,
        kanbanOrder:
          payload.kanbanOrder != null &&
          Number.isFinite(Number(payload.kanbanOrder))
            ? Math.trunc(Number(payload.kanbanOrder))
            : null,
        order: payload.order,
        lightKadrs: hasLightKadrs ? nextLightKadrs : null,
      },
    });

    console.log('[sync] Scene upsert result', {
      id: result.id,
      title: result.title,
    });

    const projectId = syncProjectIdFromCompoundId(payload?.playbookId);
    if (projectId) this.notifications.notifySceneUpdated(projectId, sourceClientId);

    // Optional: normalize nested scene data if provided in payload (requisites/light/theater).
    try {
      const sceneId = payload.id as string;
      if (typeof sceneId !== 'string' || !sceneId) return;

      const requisitesValue = payload.requisites;
      const lightPlotValue = payload.lightPlot;
      const theaterModelsValue = payload.theaterModels;
      const theaterDecorValue = payload.theaterDecor;
      const theaterSpotlightsValue = payload.theaterSpotlights;

      const tx: any[] = [];

      if (Array.isArray(requisitesValue)) {
        const data = requisitesValue
          .map((r: any) => {
            const sourceId = syncNormalizeInt(r?.id, -1);
            if (sourceId <= 0) return null;
            const label = syncNormalizeString(r?.label, '');
            if (!label) return null;
            return {
              sceneId,
              sourceId,
              label,
              checked: syncNormalizeBool(r?.checked, false),
            };
          })
          .filter(
            (
              x,
            ): x is {
              sceneId: string;
              sourceId: number;
              label: string;
              checked: boolean;
            } => x !== null,
          );
        tx.push(this.prisma.sceneRequisite.deleteMany({ where: { sceneId } }));
        if (data.length)
          tx.push(this.prisma.sceneRequisite.createMany({ data }));
      }

      if (Array.isArray(lightPlotValue)) {
        const data = lightPlotValue
          .map((f: any) => {
            const sourceId = syncNormalizeInt(f?.id, -1);
            if (sourceId <= 0) return null;
            const label = syncNormalizeString(f?.label, '');
            if (!label) return null;
            return {
              sceneId,
              sourceId,
              label,
              channel:
                typeof f?.channel === 'string' && f.channel.trim()
                  ? f.channel.trim()
                  : null,
              x: syncNormalizeInt(f?.x, 0),
              y: syncNormalizeInt(f?.y, 0),
              angle: syncNormalizeInt(f?.angle, 0),
              length: syncNormalizeInt(f?.length, 0),
            };
          })
          .filter(
            (
              x,
            ): x is {
              sceneId: string;
              sourceId: number;
              label: string;
              channel: string | null;
              x: number;
              y: number;
              angle: number;
              length: number;
            } => x !== null,
          );
        tx.push(this.prisma.sceneLightPlot.deleteMany({ where: { sceneId } }));
        if (data.length)
          tx.push(this.prisma.sceneLightPlot.createMany({ data }));
      }

      if (Array.isArray(theaterModelsValue) || Array.isArray(theaterDecorValue)) {
        const flat = flattenClientTheaterModels({
          theaterModels: Array.isArray(theaterModelsValue) ? theaterModelsValue : [],
          theaterDecor: Array.isArray(theaterDecorValue) ? theaterDecorValue : [],
        });
        const data = flat
          .map((m: any) =>
            clientTheaterModelToPrisma(
              sceneId,
              m,
              (v, fb) => syncNormalizeVec3(v, fb),
              (v, fb) => syncNormalizeInt(v, fb),
              (v, fb) => syncNormalizeString(v, fb),
              (v, fb) => syncNormalizeBool(v, fb),
            ),
          )
          .filter((x): x is NonNullable<typeof x> => x !== null);
        tx.push(this.prisma.theaterModel.deleteMany({ where: { sceneId } }));
        if (data.length)
          tx.push(
            this.prisma.theaterModel.createMany({
              data: data as Prisma.TheaterModelCreateManyInput[],
            }),
          );
      }

      if (Array.isArray(theaterSpotlightsValue)) {
        const data = theaterSpotlightsValue
          .map((sp: any) => syncMapTheaterSpotlightRow(sceneId, sp))
          .filter(Boolean) as Prisma.TheaterSpotlightCreateManyInput[];
        tx.push(this.prisma.theaterSpotlight.deleteMany({ where: { sceneId } }));
        if (data.length)
          tx.push(this.prisma.theaterSpotlight.createMany({ data }));
      }

      if (tx.length) {
        await this.prisma.$transaction(tx);
      }
    } catch (err) {
      console.error('[sync] failed to sync nested Scene payload', {
        sceneId: payload?.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
