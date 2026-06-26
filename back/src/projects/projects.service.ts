import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../files/file-storage.service';
import { LocalFileStorageService } from '../files/local-file-storage.service';
import { extractReferencedImageKeysFromProjectorMedia } from './projector-media-gc';

export interface CreateProjectDto {
  slug: string;
  name?: string;
  description?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string | null;
}

export interface AddMemberDto {
  userId: string;
  role?: string;
}

export interface InviteByEmailDto {
  email: string;
  role?: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: FileStorageService,
    private readonly localStorage: LocalFileStorageService,
  ) {}

  private async assertUserHasProjectAccess(userId: string, slug: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
      select: { id: true, slug: true, ownerId: true },
    });
    if (!project) throw new ForbiddenException('No access to project');
    return project;
  }

  private useLocalStorage(): boolean {
    return this.config.get<string>('STORAGE_TYPE') === 'local';
  }

  private extractReferencedImageKeysFromMarkdown(text: string): string[] {
    const out: string[] = [];
    const re = /\borchestra-image:([^\s)]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const raw = String(m[1] ?? '').trim();
      if (!raw) continue;
      try {
        const key = decodeURIComponent(raw);
        if (key) out.push(key);
      } catch {
        // ignore bad encoding
      }
    }
    return out;
  }

  async cleanupProjectImages(userId: string, slug: string) {
    const project = await this.assertUserHasProjectAccess(userId, slug);
    const projectId = project.id;

    // Find all referenced orchestra-image keys inside scene markdown/playMarkdown/explicationMarkdown.
    const rows = await this.prisma.scene.findMany({
      where: { playbook: { projectId }, deletedAt: null },
      select: { markdown: true, playMarkdown: true, explicationMarkdown: true },
      take: 20000,
    });
    const referenced = new Set<string>();
    for (const r of rows) {
      const text = `${r.markdown ?? ''}\n${r.playMarkdown ?? ''}\n${r.explicationMarkdown ?? ''}`;
      this.extractReferencedImageKeysFromMarkdown(text).forEach((k) =>
        referenced.add(k),
      );
    }

    const prefix = `${projectId}/image/`;

    // Also keep images referenced from sounds icons (they are uploaded as type "image" too).
    const soundRows = await this.prisma.sound.findMany({
      where: { playbook: { projectId } },
      select: { iconRemoteKey: true },
      take: 20000,
    });
    for (const s of soundRows) {
      const key = typeof s.iconRemoteKey === 'string' ? s.iconRemoteKey.trim() : '';
      if (!key) continue;
      // only consider project-scoped images
      if (key.startsWith(prefix)) referenced.add(key);
    }

    const roleRows = await this.prisma.projectRole.findMany({
      where: { projectId },
      select: { avatarKey: true },
      take: 5000,
    });
    for (const r of roleRows) {
      const key = typeof r.avatarKey === 'string' ? r.avatarKey.trim() : '';
      if (key && key.startsWith(prefix)) referenced.add(key);
    }

    const roleNoteRows = await this.prisma.projectRoleNote.findMany({
      where: { role: { projectId } },
      select: { content: true },
      take: 20000,
    });
    for (const n of roleNoteRows) {
      this.extractReferencedImageKeysFromMarkdown(String(n.content ?? '')).forEach(
        (k) => referenced.add(k),
      );
    }

    const playbookRows = await this.prisma.playbook.findMany({
      where: { projectId },
      select: { projectorMedia: true },
      take: 500,
    });
    for (const playbook of playbookRows) {
      extractReferencedImageKeysFromProjectorMedia(playbook.projectorMedia).forEach(
        (k) => {
          if (k.startsWith(prefix)) referenced.add(k);
        },
      );
    }

    // List stored image keys and delete those that are not referenced.
    if (this.useLocalStorage()) {
      // Local storage GC not implemented (dev). In prod we use MinIO.
      return {
        ok: true,
        projectId,
        storage: 'local',
        referencedCount: referenced.size,
        deletedCount: 0,
        skipped: true,
      };
    }

    const existingKeys = await this.storage.listKeys(prefix, 1000);
    const toDelete = existingKeys.filter(
      (k) => k.startsWith(prefix) && !referenced.has(k),
    );
    for (const key of toDelete.slice(0, 5000)) {
      await this.storage.deleteObject(key);
    }
    return {
      ok: true,
      projectId,
      storage: 's3',
      referencedCount: referenced.size,
      existingCount: existingKeys.length,
      deletedCount: Math.min(toDelete.length, 5000),
    };
  }

  async getTelegramBotPreference(userId: string, slug: string) {
    const project = await this.assertUserHasProjectAccess(userId, slug);

    const pref = await this.prisma.projectTelegramBotPreference.findUnique({
      where: { projectId_userId: { projectId: project.id, userId } },
      select: { botIntegrationId: true },
    });

    const bots = await this.prisma.telegramBotIntegration.findMany({
      where: { ownerUserId: userId },
      select: {
        id: true,
        title: true,
        botUsername: true,
        botTelegramUserId: true,
        status: true,
        groupChatId: true,
        attendanceThreadId: true,
        announcementsThreadId: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      selectedBotIntegrationId: pref?.botIntegrationId ?? null,
      items: bots,
    };
  }

  async setTelegramBotPreference(
    userId: string,
    slug: string,
    dto: { botIntegrationId: string | null },
  ) {
    const project = await this.assertUserHasProjectAccess(userId, slug);
    const botIntegrationIdRaw =
      dto?.botIntegrationId != null ? String(dto.botIntegrationId).trim() : '';

    if (!botIntegrationIdRaw) {
      await this.prisma.projectTelegramBotPreference.deleteMany({
        where: { projectId: project.id, userId },
      });
      return { ok: true, selectedBotIntegrationId: null };
    }

    const bot = await this.prisma.telegramBotIntegration.findFirst({
      where: { id: botIntegrationIdRaw, ownerUserId: userId },
      select: { id: true, status: true },
    });
    if (!bot) throw new NotFoundException('Telegram bot integration not found');
    if (String(bot.status) !== 'connected') {
      throw new BadRequestException('Telegram bot is not connected');
    }

    await this.prisma.projectTelegramBotPreference.upsert({
      where: { projectId_userId: { projectId: project.id, userId } },
      update: { botIntegrationId: bot.id },
      create: {
        projectId: project.id,
        userId,
        botIntegrationId: bot.id,
      },
    });

    return { ok: true, selectedBotIntegrationId: bot.id };
  }

  getUserProjects(userId: string) {
    return this.prisma.project.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerId: userId },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
      },
    });
  }

  getProjectBySlug(userId: string, slug: string) {
    return this.prisma.project.findFirst({
      where: {
        slug,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
      include: {
        playbooks: {
          include: {
            playlist: true,
            sounds: true,
            scenes: {
              include: {
                requisites: true,
                lightPlot: true,
                theaterModels: true,
                theaterSpotlights: true,
              },
            },
            lightChannels: true,
            lightPlot: true,
            theaterLayout: true,
          },
        },
      },
    });
  }

  async updateProject(userId: string, slug: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findFirst({
      where: { slug, deletedAt: null, ownerId: userId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found or not owned by user');
    }

    const data: Prisma.ProjectUpdateInput = {};
    if (dto.name !== undefined) {
      const name = String(dto.name).trim();
      if (!name) throw new BadRequestException('name is required');
      data.name = name;
    }
    if (dto.description !== undefined) {
      const description =
        dto.description == null ? null : String(dto.description).trim();
      data.description = description || null;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No project fields to update');
    }

    return this.prisma.project.update({
      where: { id: project.id },
      data,
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
      },
    });
  }

  async createProject(ownerId: string, dto: CreateProjectDto) {
    const slug = typeof dto?.slug === 'string' ? dto.slug.trim() : '';
    if (!slug) {
      throw new BadRequestException('slug is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: ownerId },
      include: { subscription: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const plan = user.subscription;
    // Лимит проверяем только если подписка есть и лимит явно задан и > 0
    if (plan?.maxProjects != null && plan.maxProjects > 0) {
      const count = await this.prisma.project.count({
        where: { ownerId, deletedAt: null },
      });
      if (count >= plan.maxProjects) {
        throw new ForbiddenException(
          `Project limit reached for current plan (${count}/${plan.maxProjects})`,
        );
      }
    }

    const name = dto.name ?? slug;
    const description = dto.description ?? null;

    // Если есть удалённый проект с таким slug у этого владельца — восстанавливаем
    const existing = await this.prisma.project.findFirst({
      where: { slug, ownerId },
    });
    if (existing) {
      if (existing.deletedAt) {
        return this.prisma.project.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            name,
            description,
            updatedAt: new Date(),
          },
        });
      }
      throw new ConflictException('Project with this slug already exists');
    }

    try {
      return await this.prisma.project.create({
        data: {
          slug,
          name,
          description,
          ownerId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Project with this slug already exists');
      }
      throw error;
    }
  }

  async addMember(ownerId: string, slug: string, dto: AddMemberDto) {
    const project = await this.prisma.project.findFirst({
      where: { slug, ownerId, deletedAt: null },
    });
    if (!project) {
      throw new NotFoundException('Project not found or not owned by user');
    }

    const userId = typeof dto?.userId === 'string' ? dto.userId.trim() : '';
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      include: { subscription: true },
    });
    const plan = owner?.subscription;

    const features = (plan?.features ?? {}) as any;

    if (!features.collaboration) {
      throw new ForbiddenException(
        'Collaboration is not available on current plan',
      );
    }

    if (plan?.maxCollaboratorsPerProject != null) {
      const membersCount = await this.prisma.projectMember.count({
        where: { projectId: project.id },
      });
      if (membersCount >= plan.maxCollaboratorsPerProject) {
        throw new ForbiddenException(
          'Collaborator limit reached for this project',
        );
      }
    }

    const role = dto.role ?? 'editor';

    try {
      return await this.prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId,
          role,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // @@unique([projectId, userId])
          throw new ConflictException(
            'User is already a member of this project',
          );
        }
        if (error.code === 'P2003') {
          // FK constraint (например, userId не существует)
          throw new NotFoundException('User not found');
        }
      }
      throw error;
    }
  }

  /** Пригласить в проект по email — только владелец. Пользователь с email должен быть зарегистрирован. */
  async inviteByEmail(userId: string, slug: string, dto: InviteByEmailDto) {
    const emailRaw = typeof dto?.email === 'string' ? dto.email : '';
    const email = emailRaw.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('email is required');
    }

    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.ownerId !== userId) {
      throw new ForbiddenException(
        'Только владелец проекта может приглашать участников',
      );
    }

    // Те же ограничения, что и в addMember (подписка/лимит коллаборации)
    const owner = await this.prisma.user.findUnique({
      where: { id: project.ownerId },
      include: { subscription: true },
    });
    const plan = owner?.subscription;
    const features = (plan?.features ?? {}) as any;

    if (!features.collaboration) {
      throw new ForbiddenException(
        'Collaboration is not available on current plan',
      );
    }
    if (plan?.maxCollaboratorsPerProject != null) {
      const membersCount = await this.prisma.projectMember.count({
        where: { projectId: project.id },
      });
      if (membersCount >= plan.maxCollaboratorsPerProject) {
        throw new ForbiddenException(
          'Collaborator limit reached for this project',
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new NotFoundException('Пользователь с таким email не найден');
    }
    const role = dto.role ?? 'editor';
    try {
      return await this.prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: user.id,
          role,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'User is already a member of this project',
          );
        }
      }
      throw error;
    }
  }

  /** Список участников проекта — только владелец может просматривать. */
  async getProjectMembers(userId: string, slug: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: {
        id: true,
        ownerId: true,
        owner: { select: { id: true, email: true } },
        members: {
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    });
    if (!project) {
      return null;
    }
    if (project.ownerId !== userId) {
      throw new ForbiddenException(
        'Только владелец проекта может просматривать список участников',
      );
    }

    const ownerEmail = project.owner?.email?.trim().toLowerCase() ?? '';
    const emails = [
      ownerEmail,
      ...project.members.map((m) => m.user.email).filter(Boolean),
    ]
      .filter(Boolean)
      .map((e) => e.trim().toLowerCase());
    const profiles = await this.prisma.userProfile.findMany({
      where: { email: { in: emails } },
      select: { email: true, displayName: true },
    });
    const displayNameByEmail = new Map(
      profiles.map((p) => [p.email, p.displayName]),
    );

    return {
      id: project.id,
      owner: project.owner?.email
        ? {
            id: project.owner.id,
            email: project.owner.email,
            displayName: displayNameByEmail.get(ownerEmail) ?? null,
          }
        : null,
      members: project.members.map((m) => ({
        ...m,
        user: {
          ...m.user,
          displayName:
            displayNameByEmail.get(m.user.email.trim().toLowerCase()) ?? null,
        },
      })),
    };
  }

  /** Изменить роль участника (только владелец). Роль: editor | viewer. */
  async updateMemberRole(
    userId: string,
    slug: string,
    memberId: string,
    dto: { role: string },
  ) {
    const project = await this.prisma.project.findFirst({
      where: { slug, deletedAt: null, ownerId: userId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found or you are not the owner');
    }
    const role = dto?.role === 'viewer' ? 'viewer' : 'editor';
    const member = await this.prisma.projectMember.updateMany({
      where: {
        id: memberId,
        projectId: project.id,
      },
      data: { role },
    });
    if (member.count === 0) {
      throw new NotFoundException('Member not found in this project');
    }
    return this.prisma.projectMember.findUniqueOrThrow({
      where: { id: memberId },
      include: { user: { select: { id: true, email: true } } },
    });
  }

  /** Удалить участника из проекта (только владелец). */
  async removeMember(userId: string, slug: string, memberId: string) {
    const project = await this.prisma.project.findFirst({
      where: { slug, deletedAt: null, ownerId: userId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found or you are not the owner');
    }
    const result = await this.prisma.projectMember.deleteMany({
      where: {
        id: memberId,
        projectId: project.id,
      },
    });
    if (result.count === 0) {
      throw new NotFoundException('Member not found in this project');
    }
    return { ok: true };
  }
}
