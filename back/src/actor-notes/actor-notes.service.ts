import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ActorAnnotationField } from '@prisma/client';

function safeToString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    typeof v === 'bigint'
  ) {
    return String(v);
  }
  if (v instanceof Date) return v.toISOString();
  return '';
}

function normSlug(v: unknown): string {
  return safeToString(v).trim();
}

function normPlaybookName(v: unknown): string {
  return safeToString(v).trim();
}

function normText(v: unknown): string {
  return safeToString(v).replace(/\r\n/g, '\n').trim();
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

  private async ensurePlaybook(projectId: string, sceneName: string) {
    const name = normPlaybookName(sceneName);
    if (!name) throw new BadRequestException('sceneName is required');
    const playbookId = `${projectId}:${name}`;
    return this.prisma.playbook.upsert({
      where: { id: playbookId },
      update: { name },
      create: { id: playbookId, projectId, name },
      select: { id: true },
    });
  }

  async getSceneNote(
    userId: string,
    projectSlug: string,
    sceneName: string,
    sceneId: number,
  ) {
    const projectId = await this.resolveProjectId(userId, projectSlug);
    await this.assertUserHasProjectAccess(userId, projectId);
    const playbook = await this.ensurePlaybook(projectId, sceneName);

    const sourceId = Math.trunc(Number(sceneId));
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      throw new BadRequestException('sceneId must be a positive integer');
    }

    const note = await this.prisma.actorNote.findFirst({
      where: {
        userId,
        projectId,
        playbookId: playbook.id,
        sceneSourceId: sourceId,
      },
      select: { id: true, text: true, createdAt: true, updatedAt: true },
    });
    return { note };
  }

  async upsertSceneNote(
    userId: string,
    projectSlug: string,
    sceneName: string,
    sceneId: number,
    text: unknown,
  ) {
    const projectId = await this.resolveProjectId(userId, projectSlug);
    await this.assertUserHasProjectAccess(userId, projectId);
    const playbook = await this.ensurePlaybook(projectId, sceneName);

    const sourceId = Math.trunc(Number(sceneId));
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      throw new BadRequestException('sceneId must be a positive integer');
    }

    const cleaned = normText(text);
    if (!cleaned) {
      await this.prisma.actorNote.deleteMany({
        where: {
          userId,
          projectId,
          playbookId: playbook.id,
          sceneSourceId: sourceId,
        },
      });
      return { note: null };
    }

    const note = await this.prisma.actorNote.upsert({
      where: {
        userId_playbookId_sceneSourceId: {
          userId,
          playbookId: playbook.id,
          sceneSourceId: sourceId,
        },
      },
      update: { text: cleaned },
      create: {
        userId,
        projectId,
        playbookId: playbook.id,
        sceneSourceId: sourceId,
        text: cleaned,
      },
      select: { id: true, text: true, createdAt: true, updatedAt: true },
    });

    return { note };
  }

  async deleteSceneNote(
    userId: string,
    projectSlug: string,
    sceneName: string,
    sceneId: number,
  ) {
    const projectId = await this.resolveProjectId(userId, projectSlug);
    await this.assertUserHasProjectAccess(userId, projectId);
    const playbook = await this.ensurePlaybook(projectId, sceneName);

    const sourceId = Math.trunc(Number(sceneId));
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      throw new BadRequestException('sceneId must be a positive integer');
    }

    await this.prisma.actorNote.deleteMany({
      where: {
        userId,
        projectId,
        playbookId: playbook.id,
        sceneSourceId: sourceId,
      },
    });
    return { ok: true };
  }

  async listAnnotations(
    userId: string,
    projectSlug: string,
    sceneName: string,
    sceneId: number,
    field: ActorAnnotationField,
  ) {
    const projectId = await this.resolveProjectId(userId, projectSlug);
    await this.assertUserHasProjectAccess(userId, projectId);
    const playbook = await this.ensurePlaybook(projectId, sceneName);

    const sourceId = Math.trunc(Number(sceneId));
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      throw new BadRequestException('sceneId must be a positive integer');
    }

    const items = await this.prisma.actorAnnotation.findMany({
      where: {
        userId,
        projectId,
        playbookId: playbook.id,
        sceneSourceId: sourceId,
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
    sceneId: number,
    field: ActorAnnotationField,
    startOffset: number,
    endOffset: number,
    selectedText: unknown,
    noteText: unknown,
  ) {
    const projectId = await this.resolveProjectId(userId, projectSlug);
    await this.assertUserHasProjectAccess(userId, projectId);
    const playbook = await this.ensurePlaybook(projectId, sceneName);

    const sourceId = Math.trunc(Number(sceneId));
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      throw new BadRequestException('sceneId must be a positive integer');
    }

    const start = Math.trunc(Number(startOffset));
    const end = Math.trunc(Number(endOffset));
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < 0
    ) {
      throw new BadRequestException('Invalid offsets');
    }
    if (end <= start) {
      throw new BadRequestException(
        'endOffset must be greater than startOffset',
      );
    }

    const note = normText(noteText);
    if (!note) throw new BadRequestException('noteText is required');

    const sel = safeToString(selectedText).trim();

    const created = await this.prisma.actorAnnotation.create({
      data: {
        userId,
        projectId,
        playbookId: playbook.id,
        sceneSourceId: sourceId,
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

  async updateAnnotation(
    userId: string,
    id: string,
    patch: { noteText?: unknown },
  ) {
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
