import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ActorAnnotationField } from '@prisma/client';

function normSlug(v: unknown): string {
  return String(v ?? '').trim();
}

function normSceneName(v: unknown): string {
  return String(v ?? '').trim();
}

function normText(v: unknown): string {
  return String(v ?? '').replace(/\r\n/g, '\n').trim();
}

@Injectable()
export class ActorNotesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertUserHasProjectAccess(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        members: { where: { userId }, select: { id: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId === userId) return;
    if (!project.members.length) throw new ForbiddenException('No access');
  }

  private async resolveProjectId(userId: string, projectSlug: string) {
    const slug = normSlug(projectSlug);
    if (!slug) throw new BadRequestException('projectSlug is required');
    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        deletedAt: null,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project.id;
  }

  private async ensureScene(projectId: string, sceneName: string) {
    const name = normSceneName(sceneName);
    if (!name) throw new BadRequestException('sceneName is required');
    const sceneId = `${projectId}:${name}`;
    // Если сцена ещё не синкнулась — создаём "пустую" запись, чтобы можно было привязать заметку.
    return this.prisma.scene.upsert({
      where: { id: sceneId },
      update: { name },
      create: { id: sceneId, projectId, name, rawJson: null },
      select: { id: true },
    });
  }

  async getStepNote(userId: string, projectSlug: string, sceneName: string, stepId: number) {
    const projectId = await this.resolveProjectId(userId, projectSlug);
    await this.assertUserHasProjectAccess(userId, projectId);
    const scene = await this.ensureScene(projectId, sceneName);

    const sourceId = Math.trunc(Number(stepId));
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      throw new BadRequestException('stepId must be a positive integer');
    }

    const note = await this.prisma.actorNote.findFirst({
      where: {
        userId,
        projectId,
        sceneId: scene.id,
        stepSourceId: sourceId,
      },
      select: { id: true, text: true, createdAt: true, updatedAt: true },
    });
    return { note };
  }

  async upsertStepNote(
    userId: string,
    projectSlug: string,
    sceneName: string,
    stepId: number,
    text: unknown,
  ) {
    const projectId = await this.resolveProjectId(userId, projectSlug);
    await this.assertUserHasProjectAccess(userId, projectId);
    const scene = await this.ensureScene(projectId, sceneName);

    const sourceId = Math.trunc(Number(stepId));
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      throw new BadRequestException('stepId must be a positive integer');
    }

    const cleaned = normText(text);
    if (!cleaned) {
      // Пустая строка = удаление заметки
      await this.prisma.actorNote.deleteMany({
        where: { userId, projectId, sceneId: scene.id, stepSourceId: sourceId },
      });
      return { note: null };
    }

    const note = await this.prisma.actorNote.upsert({
      where: {
        userId_sceneId_stepSourceId: {
          userId,
          sceneId: scene.id,
          stepSourceId: sourceId,
        },
      },
      update: { text: cleaned },
      create: {
        userId,
        projectId,
        sceneId: scene.id,
        stepSourceId: sourceId,
        text: cleaned,
      },
      select: { id: true, text: true, createdAt: true, updatedAt: true },
    });

    return { note };
  }

  async deleteStepNote(userId: string, projectSlug: string, sceneName: string, stepId: number) {
    const projectId = await this.resolveProjectId(userId, projectSlug);
    await this.assertUserHasProjectAccess(userId, projectId);
    const scene = await this.ensureScene(projectId, sceneName);

    const sourceId = Math.trunc(Number(stepId));
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      throw new BadRequestException('stepId must be a positive integer');
    }

    await this.prisma.actorNote.deleteMany({
      where: { userId, projectId, sceneId: scene.id, stepSourceId: sourceId },
    });
    return { ok: true };
  }

  async listAnnotations(
    userId: string,
    projectSlug: string,
    sceneName: string,
    stepId: number,
    field: ActorAnnotationField,
  ) {
    const projectId = await this.resolveProjectId(userId, projectSlug);
    await this.assertUserHasProjectAccess(userId, projectId);
    const scene = await this.ensureScene(projectId, sceneName);

    const sourceId = Math.trunc(Number(stepId));
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      throw new BadRequestException('stepId must be a positive integer');
    }

    const items = await this.prisma.actorAnnotation.findMany({
      where: {
        userId,
        projectId,
        sceneId: scene.id,
        stepSourceId: sourceId,
        field,
      },
      orderBy: [{ startOffset: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        startOffset: true,
        endOffset: true,
        selectedText: true,
        noteText: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { annotations: items };
  }

  async createAnnotation(
    userId: string,
    projectSlug: string,
    sceneName: string,
    stepId: number,
    field: ActorAnnotationField,
    startOffset: number,
    endOffset: number,
    selectedText: unknown,
    noteText: unknown,
  ) {
    const projectId = await this.resolveProjectId(userId, projectSlug);
    await this.assertUserHasProjectAccess(userId, projectId);
    const scene = await this.ensureScene(projectId, sceneName);

    const sourceId = Math.trunc(Number(stepId));
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      throw new BadRequestException('stepId must be a positive integer');
    }

    const start = Math.trunc(Number(startOffset));
    const end = Math.trunc(Number(endOffset));
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < 0) {
      throw new BadRequestException('Invalid offsets');
    }
    if (end <= start) {
      throw new BadRequestException('endOffset must be greater than startOffset');
    }

    const note = normText(noteText);
    if (!note) throw new BadRequestException('noteText is required');

    const sel = String(selectedText ?? '').trim();

    const created = await this.prisma.actorAnnotation.create({
      data: {
        userId,
        projectId,
        sceneId: scene.id,
        stepSourceId: sourceId,
        field,
        startOffset: start,
        endOffset: end,
        selectedText: sel || null,
        noteText: note,
      },
      select: {
        id: true,
        startOffset: true,
        endOffset: true,
        selectedText: true,
        noteText: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { annotation: created };
  }

  async updateAnnotation(userId: string, id: string, patch: { noteText?: unknown }) {
    const note = patch?.noteText != null ? normText(patch.noteText) : null;
    if (note != null && !note) {
      throw new BadRequestException('noteText cannot be empty');
    }

    const existing = await this.prisma.actorAnnotation.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Annotation not found');

    const updated = await this.prisma.actorAnnotation.update({
      where: { id },
      data: note != null ? { noteText: note } : {},
      select: {
        id: true,
        startOffset: true,
        endOffset: true,
        selectedText: true,
        noteText: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { annotation: updated };
  }

  async deleteAnnotation(userId: string, id: string) {
    const existing = await this.prisma.actorAnnotation.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) return { ok: true };

    await this.prisma.actorAnnotation.delete({ where: { id } });
    return { ok: true };
  }
}

