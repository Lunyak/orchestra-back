import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  async applyChanges(userId: string, changes: SyncChangeDto[]) {
    // eslint-disable-next-line no-console
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

      // eslint-disable-next-line no-console
      console.log('[sync] processing change', { entityType, operation, entityId: change.entityId });

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
        // eslint-disable-next-line no-console
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
  private fileValueToStorageKey(value: string, projectId: string): string | null {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const match = trimmed.match(/\/files\/play\/([^/?#]+)/);
      if (match) {
        try {
          return decodeURIComponent(match[1]);
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
  private collectFileKeysFromScene(rawJson: any, projectId: string): Set<string> {
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
      const oldKeys = this.collectFileKeysFromScene(existing?.rawJson ?? null, projectId);
      const newKeys = this.collectFileKeysFromScene(payload.rawJson, projectId);
      const toDelete = [...oldKeys].filter((k) => !newKeys.has(k));
      const storage = this.getFileStorage();
      for (const key of toDelete) {
        await storage.deleteObject(key);
      }
      if (toDelete.length > 0) {
        // eslint-disable-next-line no-console
        console.log('[sync] deleted unused files from storage', { count: toDelete.length, keys: toDelete });
      }
    }

    // eslint-disable-next-line no-console
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
        rawJson: payload.rawJson ?? null,
      },
      create: {
        id: payload.id,
        name: payload.name,
        rawJson: payload.rawJson ?? null,
        projectId: payload.projectId,
      },
    });

    // eslint-disable-next-line no-console
    console.log('[sync] Scene upsert result', { id: result.id, name: result.name });

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

    // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
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
        order: payload.order,
      },
      create: {
        id: payload.id,
        sceneId: payload.sceneId,
        sourceId: payload.sourceId,
        title: payload.title,
        markdown: payload.markdown ?? null,
        playMarkdown: payload.playMarkdown ?? null,
        order: payload.order,
      },
    });

    // eslint-disable-next-line no-console
    console.log('[sync] Step upsert result', { id: result.id, title: result.title });
  }

  /** Проверка: пользователь — владелец или участник с ролью editor. */
  private async canUserWriteToProject(
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, members: { where: { userId }, select: { role: true } } },
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
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
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
    const steps = await this.prisma.step.findMany({
      where: { sceneId: { in: sceneIds } },
    });

    const now = new Date().toISOString();

    return {
      now,
      projects,
      scenes,
      steps,
    };
  }

  // Временный метод для полной проверки содержимого таблиц Scene/Step без фильтров
  async debugAll() {
    const scenes = await this.prisma.scene.findMany();
    const steps = await this.prisma.step.findMany();
    return { scenes, steps };
  }
}

