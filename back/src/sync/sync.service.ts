import { ForbiddenException, Injectable } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { SyncChangeDto } from './dto/sync-change.dto';
import { SyncChangeApplierService } from './sync-change-applier.service';
import {
  clientTheaterModelToPrisma,
  flattenClientTheaterModels,
} from './theater-model-sync';
import {
  syncMapSceneRequisiteRow,
  syncMapTheaterSpotlightRow,
  syncNormalizeBool,
  syncNormalizeFloat,
  syncNormalizeInt,
  syncNormalizeOptionalInt,
  syncNormalizeString,
  syncNormalizeVec3,
  syncProjectIdFromCompoundId,
} from './sync-value-normalize';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsGateway,
    private readonly changeApplier: SyncChangeApplierService,
  ) {}

  private async syncScenesFromLegacyPlaybookSnapshot(
    playbookId: string,
    legacyPlaybookSnapshot: any,
  ) {
    const scenesValue = legacyPlaybookSnapshot?.scenes ?? legacyPlaybookSnapshot?.steps;
    if (!Array.isArray(scenesValue)) return;
    const parsed = scenesValue
      .map((st: any, idx: number) => {
        const sourceId = syncNormalizeInt(st?.id, -1);
        if (sourceId <= 0) return null;
        const id = `${playbookId}:${sourceId}`;
        const rawDuration =
          typeof st?.durationMin === 'number' ? st.durationMin : null;
        const durationMin =
          rawDuration != null && Number.isFinite(rawDuration) && rawDuration > 0
            ? Math.max(1, Math.min(480, Math.trunc(rawDuration)))
            : null;
        const kanbanStatus =
          typeof st?.kanbanStatus === 'string' && st.kanbanStatus.trim()
            ? st.kanbanStatus.trim()
            : null;
        const kanbanOrderRaw =
          typeof st?.kanbanOrder === 'number' ? st.kanbanOrder : null;
        const kanbanOrder =
          kanbanOrderRaw != null && Number.isFinite(kanbanOrderRaw)
            ? Math.trunc(kanbanOrderRaw)
            : null;
        return {
          id,
          playbookId,
          sourceId,
          title: syncNormalizeString(st?.title, `Scene ${sourceId}`),
          markdown: typeof st?.markdown === 'string' ? st.markdown : null,
          playMarkdown:
            typeof st?.playMarkdown === 'string' ? st.playMarkdown : null,
          explicationMarkdown:
            typeof st?.explicationMarkdown === 'string'
              ? st.explicationMarkdown
              : null,
          durationMin,
          kanbanStatus,
          kanbanOrder,
          order: idx,
          requisites: Array.isArray(st?.requisites)
            ? (st.requisites as any[])
            : [],
          lightPlot: Array.isArray(st?.lightPlot)
            ? (st.lightPlot as any[])
            : [],
          theaterModels: Array.isArray(st?.theaterModels)
            ? (st.theaterModels as any[])
            : [],
          theaterSpotlights: Array.isArray(st?.theaterSpotlights)
            ? (st.theaterSpotlights as any[])
            : [],
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      playbookId: string;
      sourceId: number;
      title: string;
      markdown: string | null;
      playMarkdown: string | null;
      explicationMarkdown: string | null;
      durationMin: number | null;
      kanbanStatus: string | null;
      kanbanOrder: number | null;
      order: number;
      requisites: any[];
      lightPlot: any[];
      theaterModels: any[];
      theaterSpotlights: any[];
    }>;

    if (parsed.length === 0) return;

    const sceneIds = parsed.map((x) => x.id);

    const requisitesData = parsed.flatMap((st) =>
      (st.requisites ?? [])
        .map((r: unknown) => syncMapSceneRequisiteRow(st.id, r))
        .filter(
          (row): row is NonNullable<ReturnType<typeof syncMapSceneRequisiteRow>> =>
            row != null,
        ),
    );

    const lightPlotData = parsed.flatMap((st) =>
      (st.lightPlot ?? [])
        .map((f: any) => {
          const sourceId = syncNormalizeInt(f?.id, -1);
          if (sourceId <= 0) return null;
          const label = syncNormalizeString(f?.label, '');
          if (!label) return null;
          return {
            sceneId: st.id,
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
        .filter(Boolean),
    ) as Array<{
      sceneId: string;
      sourceId: number;
      label: string;
      channel: string | null;
      x: number;
      y: number;
      angle: number;
      length: number;
    }>;

    const theaterModelsData = parsed.flatMap((st) =>
      flattenClientTheaterModels(st)
        .map((m: any) =>
          clientTheaterModelToPrisma(
            st.id,
            m,
            (v, fb) => syncNormalizeVec3(v, fb),
            (v, fb) => syncNormalizeInt(v, fb),
            (v, fb) => syncNormalizeString(v, fb),
            (v, fb) => syncNormalizeBool(v, fb),
          ),
        )
        .filter(Boolean),
    ) as Array<{
      sceneId: string;
      sourceId: number;
      name: string;
      type: string;
      builtin: string | null;
      file: string | null;
      kind: string;
      allowOutOfBounds: boolean;
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
      decorSize: unknown;
      decorColor: string | null;
      decorTexture: string | null;
      decorTextureRepeat: number | null;
      decorTextureMode: string | null;
      decorTextureFaces: unknown;
    }>;

    const theaterSpotlightsData = parsed.flatMap((st) =>
      (st.theaterSpotlights ?? [])
        .map((sp: any) => syncMapTheaterSpotlightRow(st.id, sp))
        .filter(Boolean),
    ) as Prisma.TheaterSpotlightCreateManyInput[];

    // Upsert scenes + overwrite nested свет/3D данные из legacy-снапшота сцены.
    const sceneUpserts = parsed.map((scene) =>
      this.prisma.scene.upsert({
        where: { id: scene.id },
        update: {
          title: scene.title,
          markdown: scene.markdown,
          playMarkdown: scene.playMarkdown,
          explicationMarkdown: scene.explicationMarkdown,
          durationMin: scene.durationMin,
          kanbanStatus: scene.kanbanStatus,
          kanbanOrder: scene.kanbanOrder,
          order: scene.order,
          deletedAt: null,
        },
        create: {
          id: scene.id,
          playbookId: scene.playbookId,
          sourceId: scene.sourceId,
          title: scene.title,
          markdown: scene.markdown,
          playMarkdown: scene.playMarkdown,
          explicationMarkdown: scene.explicationMarkdown,
          durationMin: scene.durationMin,
          kanbanStatus: scene.kanbanStatus,
          kanbanOrder: scene.kanbanOrder,
          order: scene.order,
        },
      }),
    );

    await this.prisma.$transaction([
      ...sceneUpserts,
      this.prisma.sceneRequisite.deleteMany({
        where: { sceneId: { in: sceneIds } },
      }),
      this.prisma.sceneLightPlot.deleteMany({
        where: { sceneId: { in: sceneIds } },
      }),
      this.prisma.theaterModel.deleteMany({
        where: { sceneId: { in: sceneIds } },
      }),
      this.prisma.theaterSpotlight.deleteMany({
        where: { sceneId: { in: sceneIds } },
      }),
      ...(requisitesData.length
        ? [this.prisma.sceneRequisite.createMany({ data: requisitesData })]
        : []),
      ...(lightPlotData.length
        ? [this.prisma.sceneLightPlot.createMany({ data: lightPlotData })]
        : []),
      ...(theaterModelsData.length
        ? [
            this.prisma.theaterModel.createMany({
              data: theaterModelsData as Prisma.TheaterModelCreateManyInput[],
            }),
          ]
        : []),
      ...(theaterSpotlightsData.length
        ? [
            this.prisma.theaterSpotlight.createMany({
              data: theaterSpotlightsData,
            }),
          ]
        : []),
    ]);
  }

  private playbookIdFromEntityId(entityId?: string | null): string | null {
    const raw = String(entityId ?? '').trim();
    if (!raw) return null;
    const scriptIdx = raw.indexOf(':script');
    if (scriptIdx > 0) return raw.slice(0, scriptIdx + ':script'.length);
    const colon = raw.indexOf(':');
    return colon > 0 ? raw.slice(0, colon) : null;
  }

  private hasJsonValue(value: unknown): boolean {
    if (value == null) return false;
    if (typeof value === 'object') {
      return Object.keys(value as object).length > 0;
    }
    return true;
  }

  private normalizeConfirmToken(value: string): string {
    return value.trim().toLowerCase();
  }

  private matchesDestructiveConfirm(
    project: { name: string; slug: string } | null | undefined,
    confirm: string | null | undefined,
  ): boolean {
    if (!project || !confirm?.trim()) return false;
    const token = this.normalizeConfirmToken(confirm);
    return (
      token === this.normalizeConfirmToken(project.name) ||
      token === this.normalizeConfirmToken(project.slug)
    );
  }

  private playbookPayloadWouldNullWipe(
    payload: any,
    existing: {
      sceneRoles: unknown;
      lightFaders: unknown;
      lightPrograms: unknown;
      lightChannelRoles: unknown;
      projectorMedia: unknown;
    } | null,
  ): boolean {
    if (!existing) return false;
    const pairs: Array<[string, unknown, unknown]> = [
      ['sceneRoles', payload?.sceneRoles, existing.sceneRoles],
      ['lightFaders', payload?.lightFaders, existing.lightFaders],
      ['lightPrograms', payload?.lightPrograms, existing.lightPrograms],
      ['lightChannelRoles', payload?.lightChannelRoles, existing.lightChannelRoles],
      ['projectorMedia', payload?.projectorMedia, existing.projectorMedia],
    ];
    return pairs.some(([key, next, current]) => {
      if (!Object.prototype.hasOwnProperty.call(payload ?? {}, key)) return false;
      return next == null && this.hasJsonValue(current);
    });
  }

  private async classifyDestructiveChanges(
    changes: SyncChangeDto[],
  ): Promise<Set<SyncChangeDto>> {
    const destructive = new Set<SyncChangeDto>();
    const playbookIds = new Set<string>();

    for (const change of changes) {
      if (change.entityType === 'Project' && change.operation === 'delete') {
        destructive.add(change);
      }
      const playbookId =
        String(change.payload?.playbookId ?? change.payload?.sceneId ?? '').trim() ||
        this.playbookIdFromEntityId(change.entityId);
      if (playbookId) playbookIds.add(playbookId);
    }

    for (const playbookId of playbookIds) {
      const [activeScenes, activePlaylist, activeSounds, existingPlaybook] =
        await Promise.all([
          this.prisma.scene.count({ where: { playbookId, deletedAt: null } }),
          this.prisma.playlistItem.count({ where: { playbookId } }),
          this.prisma.sound.count({ where: { playbookId } }),
          this.prisma.playbook.findUnique({ where: { id: playbookId }, select: { sceneRoles: true,
              lightFaders: true,
              lightPrograms: true,
              lightChannelRoles: true,
              projectorMedia: true,
            },
          }),
        ]);

      const sceneDeletes = changes.filter(
        (c) =>
          c.entityType === 'Scene' &&
          c.operation === 'delete' &&
          this.playbookIdFromEntityId(c.entityId) === playbookId,
      );
      const sceneDeleteThreshold = Math.max(2, Math.ceil(activeScenes * 0.4));
      if (activeScenes > 0 && sceneDeletes.length >= sceneDeleteThreshold) {
        sceneDeletes.forEach((c) => destructive.add(c));
      }

      const playlistDeletes = changes.filter(
        (c) =>
          c.entityType === 'PlaylistItem' &&
          c.operation === 'delete' &&
          String(c.payload?.playbookId ?? c.payload?.sceneId ?? '') === playbookId,
      );
      const playlistDeleteThreshold = Math.max(3, Math.ceil(activePlaylist * 0.4));
      if (activePlaylist > 0 && playlistDeletes.length >= playlistDeleteThreshold) {
        playlistDeletes.forEach((c) => destructive.add(c));
      }

      const soundDeletes = changes.filter(
        (c) =>
          c.entityType === 'Sound' &&
          c.operation === 'delete' &&
          String(c.payload?.playbookId ?? c.payload?.sceneId ?? '') === playbookId,
      );
      const soundDeleteThreshold = Math.max(2, Math.ceil(activeSounds * 0.4));
      if (activeSounds > 0 && soundDeletes.length >= soundDeleteThreshold) {
        soundDeletes.forEach((c) => destructive.add(c));
      }

      for (const change of changes) {
        if (
          change.entityType === 'Playbook' &&
          change.operation !== 'delete' &&
          String(change.payload?.id ?? '') === playbookId &&
          this.playbookPayloadWouldNullWipe(change.payload, existingPlaybook)
        ) {
          destructive.add(change);
        }
      }
    }

    return destructive;
  }

  private async guardSyncPush(
    changes: SyncChangeDto[],
    destructiveConfirm?: string | null,
  ): Promise<{
    allowed: SyncChangeDto[];
    confirmedProjectIds: Set<string>;
    blockedCount: number;
  }> {
    if (!changes.length) {
      return { allowed: [], confirmedProjectIds: new Set(), blockedCount: 0 };
    }

    const destructive = await this.classifyDestructiveChanges(changes);
    if (!destructive.size) {
      return {
        allowed: changes,
        confirmedProjectIds: new Set(),
        blockedCount: 0,
      };
    }

    const projectIds = new Set<string>();
    for (const change of destructive) {
      const projectId = await this.getProjectIdForChange(
        change.entityType,
        change.payload,
      );
      if (projectId) projectIds.add(projectId);
    }

    const confirmedProjectIds = new Set<string>();
    for (const projectId of projectIds) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, slug: true },
      });
      if (this.matchesDestructiveConfirm(project, destructiveConfirm)) {
        confirmedProjectIds.add(projectId);
      }
    }

    const allowed: SyncChangeDto[] = [];
    let blockedCount = 0;

    for (const change of changes) {
      if (!destructive.has(change)) {
        allowed.push(change);
        continue;
      }
      const projectId = await this.getProjectIdForChange(
        change.entityType,
        change.payload,
      );
      if (projectId && confirmedProjectIds.has(projectId)) {
        allowed.push(change);
        continue;
      }
      blockedCount += 1;
      console.warn('[sync] blocked destructive change without project confirm', {
        entityType: change.entityType,
        operation: change.operation,
        entityId: change.entityId,
        projectId,
        destructiveConfirm: destructiveConfirm ? '[provided]' : null,
      });
    }

    return { allowed, confirmedProjectIds, blockedCount };
  }

  async applyChanges(
    userId: string,
    changes: SyncChangeDto[],
    sourceClientId?: string | null,
    destructiveConfirm?: string | null,
  ) {
    const { allowed, confirmedProjectIds, blockedCount } =
      await this.guardSyncPush(changes, destructiveConfirm);

    console.log('[sync] applyChanges called', {
      userId,
      changesCount: allowed.length,
      blockedCount,
      sourceClientId: sourceClientId ?? null,
      changes: allowed.map((c) => ({
        entityType: c.entityType,
        operation: c.operation,
        entityId: c.entityId,
      })),
    });

    for (const change of allowed) {
      const entityType =
        change.entityType === 'Step' ? 'Scene' : change.entityType;
      const { operation, payload } = change;

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
          await this.changeApplier.applyProjectChange(userId, operation, payload);
        }
        if (entityType === 'Playbook') {
          const allowNullWipe =
            !!projectId && confirmedProjectIds.has(projectId);
          await this.changeApplier.applyPlaybookChange(
            userId,
            operation,
            payload,
            sourceClientId,
            allowNullWipe,
          );
        }
        if (entityType === 'Scene') {
          const sourceId = syncNormalizeInt(payload?.sourceId, -1);
          const isPlaybookMeta =
            sourceId <= 0 &&
            payload?.projectId &&
            typeof payload?.name === 'string';
          if (isPlaybookMeta) {
            await this.changeApplier.applyPlaybookChange(
              userId,
              operation,
              payload,
              sourceClientId,
              !!projectId && confirmedProjectIds.has(projectId),
            );
          } else {
            await this.changeApplier.applySceneChange(
              userId,
              operation,
              {
                ...payload,
                playbookId: String(
                  payload?.playbookId ?? payload?.sceneId ?? '',
                ).trim(),
              },
              sourceClientId,
            );
          }
        }
        if (entityType === 'PlaylistItem') {
          await this.changeApplier.applyPlaylistItemChange(operation, payload, sourceClientId);
        }
        if (entityType === 'Sound') {
          await this.changeApplier.applySoundChange(operation, payload, sourceClientId);
        }
        if (entityType === 'GlobalLightChannel') {
          await this.changeApplier.applyGlobalLightChannelChange(operation, payload, sourceClientId);
        }
        if (entityType === 'TheaterLayout') {
          await this.changeApplier.applyTheaterLayoutChange(operation, payload, sourceClientId);
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
            playbookId: payload?.playbookId,
          },
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // НЕ пробрасываем ошибку, чтобы увидеть все проблемы за один раз
      }
    }
    return { ok: true };
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
    if (entityType === 'Playbook' && payload?.projectId) return payload.projectId;
    if (
      (entityType === 'Scene' ||
        entityType === 'PlaylistItem' ||
        entityType === 'Sound' ||
        entityType === 'GlobalLightChannel' ||
        entityType === 'TheaterLayout') &&
      (payload?.playbookId ?? payload?.sceneId)
    ) {
      const playbookId = String(
        payload?.playbookId ?? payload?.sceneId ?? '',
      ).trim();
      if (!playbookId) return null;
      const playbook = await this.prisma.playbook.findUnique({
        where: { id: playbookId },
        select: { projectId: true },
      });
      return playbook?.projectId ?? null;
    }
    return null;
  }

  /** Возвращает снимок проектов, playbooks и scenes. Если передан projectSlug — только по этому проекту. */
  async getChangesSince(
    userId: string,
    _lastSyncAt: string | null,
    projectSlug?: string,
    include?: {
      scenes?: boolean;
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
      return { now, projects: [], playbooks: [], scenes: [] };
    }

    const projectIds = projects.map((p) => p.id);

    const playbooks = await this.prisma.playbook.findMany({ where: { projectId: { in: projectIds } },
    });

    const playbookIds = playbooks.map((s) => s.id);

    const wantScenes = Boolean(include?.scenes ?? include?.steps);
    const wantPlaylist = Boolean(include?.playlist);
    const wantSounds = Boolean(include?.sounds);
    const wantLightChannels = Boolean(include?.lightChannels);
    const wantTheaterLayout = Boolean(include?.theaterLayout);

    const scenesRaw = wantScenes
      ? await this.prisma.scene.findMany({
          where: { playbookId: { in: playbookIds }, deletedAt: null },
          include: {
            requisites: true,
            lightPlot: true,
            theaterModels: true,
            theaterSpotlights: true,
          },
          orderBy: [{ playbookId: 'asc' }, { order: 'asc' }],
        })
      : [];

    // Дедуп сцен по (playbookId, sourceId).
    // Причина: ранее могли приехать Scene с неконсистентным id (другая "префиксная" часть),
    // что приводило к двум строкам с одинаковым sourceId в одной сцене.
    const scenesByComposite = new Map<string, (typeof scenesRaw)[number]>();
    for (const st of scenesRaw) {
      const k = `${st.playbookId}:${st.sourceId}`;
      const prev = scenesByComposite.get(k);
      if (!prev) {
        scenesByComposite.set(k, st);
        continue;
      }
      // Берём "самый свежий" как источник истины
      if (st.updatedAt > prev.updatedAt) scenesByComposite.set(k, st);
    }
    const scenes = Array.from(scenesByComposite.values()).sort((a, b) => {
      if (a.playbookId !== b.playbookId) return a.playbookId < b.playbookId ? -1 : 1;
      return a.order - b.order;
    });

    const scenesByPlaybookId = new Map<string, typeof scenes>();
    for (const st of scenes) {
      const list = scenesByPlaybookId.get(st.playbookId) ?? [];
      list.push(st);
      scenesByPlaybookId.set(st.playbookId, list);
    }

    const playlistItems = wantPlaylist
      ? await this.prisma.playlistItem.findMany({
          where: { playbookId: { in: playbookIds } },
          orderBy: [{ playbookId: 'asc' }, { order: 'asc' }],
        })
      : [];

    const sounds = wantSounds
      ? await this.prisma.sound.findMany({
          where: { playbookId: { in: playbookIds } },
          orderBy: [{ playbookId: 'asc' }, { sourceId: 'asc' }],
        })
      : [];

    const lightChannels = wantLightChannels
      ? await this.prisma.globalLightChannel.findMany({
          where: { playbookId: { in: playbookIds } },
          orderBy: [{ playbookId: 'asc' }, { index: 'asc' }],
        })
      : [];

    const theaterLayouts = wantTheaterLayout
      ? await this.prisma.theaterLayout.findMany({
          where: { playbookId: { in: playbookIds } },
        })
      : [];

    const now = new Date().toISOString();
    const playbooksForClient = playbooks;

    return {
      now,
      projects,
      playbooks: playbooksForClient,
      ...(wantScenes ? { scenes } : {}),
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
      scenes?: boolean;
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
    if (!name) throw new NotFoundException('Playbook not found');

    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        deletedAt: null,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true, slug: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const playbookId = `${project.id}:${name}`;
    const playbook = await this.prisma.playbook.findUnique({ where: { id: playbookId },
    });
    if (!playbook) throw new NotFoundException('Playbook not found');

    const wantScenes = Boolean(include?.scenes ?? include?.steps);
    const wantPlaylist = Boolean(include?.playlist);
    const wantSounds = Boolean(include?.sounds);
    const wantLightChannels = Boolean(include?.lightChannels);
    const wantTheaterLayout = Boolean(include?.theaterLayout);

    const scenesRaw = wantScenes
      ? await this.prisma.scene.findMany({
          where: { playbookId, deletedAt: null },
          include: {
            requisites: true,
            lightPlot: true,
            theaterModels: true,
            theaterSpotlights: true,
          },
          orderBy: { order: 'asc' },
        })
      : [];
    const scenesBySourceId = new Map<number, (typeof scenesRaw)[number]>();
    for (const st of scenesRaw) {
      const prev = scenesBySourceId.get(st.sourceId);
      if (!prev || st.updatedAt > prev.updatedAt)
        scenesBySourceId.set(st.sourceId, st);
    }
    const scenes = Array.from(scenesBySourceId.values()).sort(
      (a, b) => a.order - b.order,
    );

    const playlistItems = wantPlaylist
      ? await this.prisma.playlistItem.findMany({
          where: { playbookId },
          orderBy: { order: 'asc' },
        })
      : [];
    const sounds = wantSounds
      ? await this.prisma.sound.findMany({
          where: { playbookId },
          orderBy: { sourceId: 'asc' },
        })
      : [];
    const lightChannels = wantLightChannels
      ? await this.prisma.globalLightChannel.findMany({
          where: { playbookId },
          orderBy: { index: 'asc' },
        })
      : [];
    const theaterLayout = wantTheaterLayout
      ? await this.prisma.theaterLayout.findUnique({
          where: { playbookId },
        })
      : null;

    return {
      playbook: {
        id: playbook.id,
        projectId: playbook.projectId,
        name: playbook.name,
        sceneRoles: playbook.sceneRoles,
        lightFaders: playbook.lightFaders,
        lightPrograms: playbook.lightPrograms,
        lightChannelRoles: playbook.lightChannelRoles,
        projectorMedia: playbook.projectorMedia,
        updatedAt: playbook.updatedAt,
      },
      ...(wantScenes ? { scenes } : {}),
      ...(wantPlaylist ? { playlistItems } : {}),
      ...(wantSounds ? { sounds } : {}),
      ...(wantLightChannels ? { lightChannels } : {}),
      ...(wantTheaterLayout ? { theaterLayout } : {}),
    };
  }

  // Временный метод для полной проверки содержимого таблиц Playbook/Scene без фильтров
  async debugAll() {
    const playbooks = await this.prisma.playbook.findMany();
    const scenes = await this.prisma.scene.findMany();
    return { playbooks, scenes };
  }
}