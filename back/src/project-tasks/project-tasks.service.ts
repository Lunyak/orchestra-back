import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProjectTaskCategory,
  ProjectTaskSource,
  ProjectTaskStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProjectTaskDto,
  ImportRequisiteTasksDto,
  UpdateProjectTaskDto,
} from './dto/project-tasks.dto';

function normEmail(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

function normSlug(v: unknown): string {
  return String(v ?? '').trim();
}

const taskSelect = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  status: true,
  category: true,
  source: true,
  sourceKey: true,
  assigneeEmail: true,
  dueAt: true,
  refSceneId: true,
  refRequisiteId: true,
  refAction: true,
  sortOrder: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

type TaskRow = Prisma.ProjectTaskGetPayload<{ select: typeof taskSelect }>;

type TaskViewer = { userId: string; email: string };

function canChangeTaskStatus(
  viewer: TaskViewer,
  task: Pick<TaskRow, 'assigneeEmail' | 'createdById'>,
): boolean {
  const viewerEmail = normEmail(viewer.email);
  const assigneeEmail = normEmail(task.assigneeEmail);
  const isAssignee = Boolean(assigneeEmail && assigneeEmail === viewerEmail);
  const isCreator = Boolean(
    task.createdById && task.createdById === viewer.userId,
  );
  return isAssignee || isCreator;
}

function serializeTask(row: TaskRow, viewer?: TaskViewer) {
  return {
    ...row,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    canChangeStatus: viewer ? canChangeTaskStatus(viewer, row) : undefined,
  };
}

@Injectable()
export class ProjectTasksService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveProject(userId: string, projectSlugRaw: string) {
    const slug = normSlug(projectSlugRaw);
    if (!slug) throw new BadRequestException('projectSlug is required');

    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        deletedAt: null,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true, slug: true, name: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async getTaskForUser(userId: string, taskId: string) {
    const task = await this.prisma.projectTask.findUnique({
      where: { id: taskId },
      select: {
        ...taskSelect,
        project: {
          select: {
            id: true,
            slug: true,
            name: true,
            ownerId: true,
            members: { where: { userId }, select: { id: true } },
          },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    const hasAccess =
      task.project.ownerId === userId || task.project.members.length > 0;
    if (!hasAccess) throw new ForbiddenException('No access');
    return task;
  }

  async list(userId: string, email: string, projectSlug: string) {
    const project = await this.resolveProject(userId, projectSlug);
    const viewer = { userId, email };
    const rows = await this.prisma.projectTask.findMany({
      where: { projectId: project.id },
      select: taskSelect,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return {
      project: { id: project.id, slug: project.slug, name: project.name },
      tasks: rows.map((row) => serializeTask(row, viewer)),
    };
  }

  async getOne(userId: string, email: string, taskId: string) {
    const task = await this.getTaskForUser(userId, taskId);
    const viewer = { userId, email };
    const { project, ...row } = task;
    return {
      project: {
        id: project.id,
        slug: project.slug,
        name: project.name,
      },
      task: serializeTask(row, viewer),
    };
  }

  async create(userId: string, email: string, body: CreateProjectTaskDto) {
    const project = await this.resolveProject(userId, body.projectSlug);
    const maxOrder = await this.prisma.projectTask.aggregate({
      where: { projectId: project.id },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    const assigneeEmail = body.assigneeEmail
      ? normEmail(body.assigneeEmail)
      : null;
    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (dueAt && !Number.isFinite(dueAt.getTime())) {
      throw new BadRequestException('Invalid dueAt');
    }

    const row = await this.prisma.projectTask.create({
      data: {
        projectId: project.id,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        status: body.status ?? ProjectTaskStatus.todo,
        category: body.category ?? ProjectTaskCategory.other,
        source: ProjectTaskSource.manual,
        assigneeEmail,
        dueAt,
        sortOrder,
        createdById: userId,
      },
      select: taskSelect,
    });

    return serializeTask(row, { userId, email });
  }

  async update(
    userId: string,
    email: string,
    taskId: string,
    body: UpdateProjectTaskDto,
  ) {
    const task = await this.getTaskForUser(userId, taskId);
    const viewer = { userId, email };

    if (body.status !== undefined && body.status !== task.status) {
      if (!canChangeTaskStatus(viewer, task)) {
        throw new ForbiddenException(
          'Only assignee or creator can change task status',
        );
      }
    }

    const data: Prisma.ProjectTaskUpdateInput = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.description !== undefined) {
      data.description = body.description?.trim() || null;
    }
    if (body.status !== undefined) data.status = body.status;
    if (body.category !== undefined) data.category = body.category;
    if (body.assigneeEmail !== undefined) {
      data.assigneeEmail = body.assigneeEmail
        ? normEmail(body.assigneeEmail)
        : null;
    }
    if (body.dueAt !== undefined) {
      if (body.dueAt === null) {
        data.dueAt = null;
      } else {
        const dueAt = new Date(body.dueAt);
        if (!Number.isFinite(dueAt.getTime())) {
          throw new BadRequestException('Invalid dueAt');
        }
        data.dueAt = dueAt;
      }
    }
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

    const row = await this.prisma.projectTask.update({
      where: { id: taskId },
      data,
      select: taskSelect,
    });
    return serializeTask(row, viewer);
  }

  async remove(userId: string, taskId: string) {
    await this.getTaskForUser(userId, taskId);
    await this.prisma.projectTask.delete({ where: { id: taskId } });
    return { ok: true as const };
  }

  async importRequisites(
    userId: string,
    email: string,
    body: ImportRequisiteTasksDto,
  ) {
    const project = await this.resolveProject(userId, body.projectSlug);
    const items = Array.isArray(body.tasks) ? body.tasks : [];
    if (!items.length) return { created: 0, skipped: 0, tasks: [] as ReturnType<typeof serializeTask>[] };

    const viewer = { userId, email };

    const maxOrder = await this.prisma.projectTask.aggregate({
      where: { projectId: project.id },
      _max: { sortOrder: true },
    });
    let sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const created: ReturnType<typeof serializeTask>[] = [];
    let skipped = 0;

    for (const item of items) {
      const sourceKey = String(item.sourceKey ?? '').trim();
      if (!sourceKey) {
        skipped += 1;
        continue;
      }
      const existing = await this.prisma.projectTask.findFirst({
        where: { projectId: project.id, sourceKey },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const row = await this.prisma.projectTask.create({
        data: {
          projectId: project.id,
          title: item.title.trim(),
          source: ProjectTaskSource.requisite,
          sourceKey,
          category: ProjectTaskCategory.props,
          status: ProjectTaskStatus.todo,
          assigneeEmail: item.assigneeEmail
            ? normEmail(item.assigneeEmail)
            : null,
          refSceneId: item.refSceneId,
          refRequisiteId: item.refRequisiteId,
          refAction: item.refAction,
          sortOrder,
          createdById: userId,
        },
        select: taskSelect,
      });
      sortOrder += 1;
      created.push(serializeTask(row, viewer));
    }

    return { created: created.length, skipped, tasks: created };
  }
}
