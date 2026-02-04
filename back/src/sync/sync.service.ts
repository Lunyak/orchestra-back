import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncChangeDto } from './dto/sync-change.dto';

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

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

  /** Возвращает полный снимок проектов, сцен и шагов, к которым у пользователя есть доступ (владелец или участник). */
  async getChangesSince(userId: string, _lastSyncAt: string | null) {
    const projectAccessWhere = {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    };

    const projects = await this.prisma.project.findMany({
      where: projectAccessWhere,
    });

    const scenes = await this.prisma.scene.findMany({
      where: {
        project: projectAccessWhere,
      },
    });

    const steps = await this.prisma.step.findMany({
      where: {
        scene: {
          project: projectAccessWhere,
        },
      },
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

