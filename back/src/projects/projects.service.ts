import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../files/file-storage.service';
import { LocalFileStorageService } from '../files/local-file-storage.service';
import { extractReferencedImageKeysFromProjectorMedia } from './projector-media-gc';
import { ProjectAccessService } from '../project-access/project-access.service';
import { TroupeService } from '../troupe/troupe.service';
import { touchProjectActivity } from './project-activity';

export interface CreateProjectDto {
  slug: string;
  name?: string;
  description?: string;
  workspaceId?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string | null;
  slug?: string;
}

export interface AddMemberDto {
  userId: string;
  role?: string;
}

export interface InviteByEmailDto {
  email: string;
  role?: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function sha256Base64Url(input: string): string {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

function slugifyRoleTitle(raw: unknown): string {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `role-${Date.now()}`;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: FileStorageService,
    private readonly localStorage: LocalFileStorageService,
    private readonly projectAccess: ProjectAccessService,
    private readonly troupeService: TroupeService,
  ) {}

  private async ensurePersonalWorkspace(userId: string) {
    return this.prisma.workspace.upsert({
      where: { personalOwnerId: userId },
      update: {},
      create: {
        type: 'PERSONAL',
        name: 'Личное пространство',
        personalOwnerId: userId,
        memberships: { create: { userId, role: 'OWNER' } },
      },
    });
  }

  private async resolveCreateWorkspace(userId: string, workspaceId?: string) {
    if (!workspaceId) return this.ensurePersonalWorkspace(userId);
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        memberships: {
          some: { userId, role: { in: ['OWNER', 'ADMIN'] } },
        },
      },
    });
    if (!workspace) {
      throw new ForbiddenException('No permission to create projects here');
    }
    return workspace;
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
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'write',
    );
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
      const key =
        typeof s.iconRemoteKey === 'string' ? s.iconRemoteKey.trim() : '';
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
      this.extractReferencedImageKeysFromMarkdown(
        String(n.content ?? ''),
      ).forEach((k) => referenced.add(k));
    }

    const playbookRows = await this.prisma.playbook.findMany({
      where: { projectId },
      select: { projectorMedia: true },
      take: 500,
    });
    for (const playbook of playbookRows) {
      extractReferencedImageKeysFromProjectorMedia(
        playbook.projectorMedia,
      ).forEach((k) => {
        if (k.startsWith(prefix)) referenced.add(k);
      });
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
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'read',
    );

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
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'read',
    );
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
        ...this.projectAccess.readWhere(userId),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        updatedAt: true,
        workspace: {
          select: { id: true, type: true, name: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getProjectBySlug(userId: string, slug: string) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'read',
    );
    return this.prisma.project.findUnique({
      where: { id: project.id },
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
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'owner',
    );

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
    if (dto.slug !== undefined) {
      const nextSlug = String(dto.slug)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      if (!nextSlug) {
        throw new BadRequestException('slug is required');
      }
      if (nextSlug.length > 80) {
        throw new BadRequestException('slug is too long');
      }
      if (nextSlug !== project.slug) {
        const taken = await this.prisma.project.findUnique({
          where: { slug: nextSlug },
          select: { id: true },
        });
        if (taken && taken.id !== project.id) {
          throw new ConflictException('Project with this slug already exists');
        }
        data.slug = nextSlug;
      }
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
    const workspace = await this.resolveCreateWorkspace(
      ownerId,
      dto.workspaceId?.trim(),
    );

    // Если есть удалённый проект с таким slug у этого владельца — восстанавливаем
    const existing = await this.prisma.project.findFirst({
      where: { slug },
    });
    if (existing) {
      if (existing.deletedAt) {
        return this.prisma.project.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            name,
            description,
            workspaceId: workspace.id,
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
          workspaceId: workspace.id,
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

  async getProjectLinks(userId: string, slug: string) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'read',
    );
    const links = await this.prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      select: {
        workspaceId: true,
        theaters: {
          select: {
            participationType: true,
            theater: { select: { id: true, title: true } },
          },
        },
      },
    });
    return links;
  }

  async getProjectAccess(userId: string, slug: string) {
    return this.projectAccess.assertBySlug(userId, slug, 'read');
  }

  async linkTheater(
    userId: string,
    slug: string,
    theaterId: string,
    participationType?: string,
  ) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'owner',
    );
    const theater = await this.prisma.theater.findFirst({
      where: {
        id: theaterId,
        workspace: {
          memberships: {
            some: { userId, role: { in: ['OWNER', 'ADMIN'] } },
          },
        },
      },
      select: { id: true, workspaceId: true },
    });
    if (!theater) throw new ForbiddenException('Cannot link this theater');
    return this.prisma.$transaction(async (tx) =>
      this.applyTheaterLink(
        tx,
        project.id,
        theater.id,
        theater.workspaceId,
        participationType,
      ),
    );
  }

  private async applyTheaterLink(
    tx: Prisma.TransactionClient,
    projectId: string,
    theaterId: string,
    theaterWorkspaceId: string,
    participationType?: string,
  ) {
    const link = await tx.projectTheater.upsert({
      where: { projectId_theaterId: { projectId, theaterId } },
      update: { participationType: participationType?.trim() || 'PARTNER' },
      create: {
        projectId,
        theaterId,
        participationType: participationType?.trim() || 'PARTNER',
      },
    });
    const rehearsals = await tx.rehearsal.findMany({
      where: {
        OR: [{ projectId }, { projects: { some: { projectId } } }],
      },
      select: { id: true },
    });
    if (rehearsals.length) {
      await tx.rehearsalWorkspace.createMany({
        data: rehearsals.map((rehearsal) => ({
          rehearsalId: rehearsal.id,
          workspaceId: theaterWorkspaceId,
        })),
        skipDuplicates: true,
      });
    }
    return link;
  }

  async unlinkTheater(userId: string, slug: string, theaterId: string) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'owner',
    );
    const result = await this.prisma.projectTheater.deleteMany({
      where: { projectId: project.id, theaterId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Theater link not found');
    }
    return { ok: true };
  }

  async createTheaterInvite(userId: string, slug: string) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'owner',
    );
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256Base64Url(rawToken);
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const invite = await this.prisma.projectTheaterInvite.create({
      data: {
        projectId: project.id,
        tokenHash,
        createdByUserId: userId,
        expiresAt,
      },
    });
    return {
      id: invite.id,
      token: rawToken,
      invitePath: `/projects/theater-invite/${rawToken}`,
      expiresAt: invite.expiresAt,
    };
  }

  async listTheaterInvites(userId: string, slug: string) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'owner',
    );
    return this.prisma.projectTheaterInvite.findMany({
      where: {
        projectId: project.id,
        revokedAt: null,
        acceptedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeTheaterInvite(userId: string, slug: string, inviteId: string) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'owner',
    );
    const result = await this.prisma.projectTheaterInvite.updateMany({
      where: {
        id: inviteId,
        projectId: project.id,
        revokedAt: null,
        acceptedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Active theater invite not found');
    }
    return { ok: true };
  }

  async previewTheaterInvite(userId: string, rawToken: string) {
    const tokenHash = sha256Base64Url(String(rawToken ?? '').trim());
    const invite = await this.prisma.projectTheaterInvite.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        acceptedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        expiresAt: true,
        createdAt: true,
        project: { select: { id: true, slug: true, name: true } },
        createdBy: { select: { email: true } },
      },
    });
    if (!invite) {
      throw new NotFoundException('Active theater invite not found');
    }
    const theaters = await this.prisma.theater.findMany({
      where: {
        workspace: {
          memberships: {
            some: { userId, role: { in: ['OWNER', 'ADMIN'] } },
          },
        },
      },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });
    return {
      kind: 'project_theater_invite' as const,
      id: invite.id,
      project: invite.project,
      invitedByEmail: invite.createdBy.email,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      theaters,
    };
  }

  async acceptTheaterInvite(
    userId: string,
    rawToken: string,
    dto: { theaterId: string },
  ) {
    const theaterId = String(dto?.theaterId ?? '').trim();
    if (!theaterId) {
      throw new BadRequestException('theaterId is required');
    }
    const tokenHash = sha256Base64Url(String(rawToken ?? '').trim());
    const invite = await this.prisma.projectTheaterInvite.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        acceptedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        projectId: true,
        project: { select: { slug: true } },
      },
    });
    if (!invite) {
      throw new NotFoundException('Active theater invite not found');
    }
    const theater = await this.prisma.theater.findFirst({
      where: {
        id: theaterId,
        workspace: {
          memberships: {
            some: { userId, role: { in: ['OWNER', 'ADMIN'] } },
          },
        },
      },
      select: { id: true, workspaceId: true },
    });
    if (!theater) {
      throw new ForbiddenException('Cannot link this theater');
    }

    const link = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectTheaterInvite.updateMany({
        where: {
          id: invite.id,
          acceptedAt: null,
          revokedAt: null,
        },
        data: {
          acceptedAt: new Date(),
          acceptedTheaterId: theater.id,
        },
      });
      if (updated.count === 0) {
        throw new ConflictException('Invite already used');
      }
      return this.applyTheaterLink(
        tx,
        invite.projectId,
        theater.id,
        theater.workspaceId,
      );
    });

    return {
      ok: true,
      link,
      projectSlug: invite.project.slug,
      theaterId: theater.id,
    };
  }

  async addMember(actorUserId: string, slug: string, dto: AddMemberDto) {
    const access = await this.projectAccess.assertBySlug(
      actorUserId,
      slug,
      'manageMembers',
    );
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: access.project.id },
    });

    const userId = typeof dto?.userId === 'string' ? dto.userId.trim() : '';
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

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

  /** Пригласить в проект по email — создаёт pending-приглашение. */
  async inviteByEmail(userId: string, slug: string, dto: InviteByEmailDto) {
    const emailRaw = typeof dto?.email === 'string' ? dto.email : '';
    const email = normalizeEmail(emailRaw);
    if (!email) {
      throw new BadRequestException('email is required');
    }

    const access = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'manageMembers',
    );
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: access.project.id },
      select: { id: true, slug: true, name: true, ownerId: true },
    });

    const owner = await this.prisma.user.findUnique({
      where: { id: project.ownerId },
      include: { subscription: true },
    });
    const plan = owner?.subscription;
    const features = (plan?.features ?? {}) as Record<string, unknown>;

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

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      const alreadyMember = await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: project.id,
            userId: existingUser.id,
          },
        },
      });
      if (alreadyMember) {
        throw new ConflictException('User is already a member of this project');
      }
    }

    const now = new Date();
    const activeInvite = await this.prisma.projectInvite.findFirst({
      where: {
        projectId: project.id,
        email,
        acceptedAt: null,
        declinedAt: null,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (activeInvite) {
      throw new ConflictException('Active invite for this email already exists');
    }

    const role = dto.role ?? 'editor';
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256Base64Url(rawToken);
    const invite = await this.prisma.projectInvite.create({
      data: {
        projectId: project.id,
        tokenHash,
        role,
        email,
        createdByUserId: userId,
      },
    });

    return {
      id: invite.id,
      token: rawToken,
      invitePath: `/projects/invite/${rawToken}`,
      role: invite.role,
      email: invite.email,
      expiresAt: invite.expiresAt,
      project: { id: project.id, slug: project.slug, name: project.name },
    };
  }

  async previewAddressedInvite(userId: string, userEmail: string, inviteId: string) {
    const myEmail = normalizeEmail(userEmail);
    const now = new Date();
    const invite = await this.prisma.projectInvite.findFirst({
      where: {
        id: inviteId,
        email: myEmail,
        acceptedAt: null,
        declinedAt: null,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        project: { select: { id: true, slug: true, name: true } },
        createdBy: { select: { email: true } },
      },
    });
    if (!invite) {
      throw new NotFoundException('Active addressed invite not found');
    }
    return {
      kind: 'project_invite' as const,
      id: invite.id,
      project: invite.project,
      role: invite.role,
      email: invite.email,
      invitedByEmail: invite.createdBy.email,
      isActive: true,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    };
  }

  async acceptAddressedInvite(userId: string, userEmail: string, inviteId: string) {
    const myEmail = normalizeEmail(userEmail);
    const now = new Date();
    const invite = await this.prisma.projectInvite.findFirst({
      where: {
        id: inviteId,
        email: myEmail,
        acceptedAt: null,
        declinedAt: null,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        project: { select: { id: true, slug: true, name: true, ownerId: true } },
      },
    });
    if (!invite) {
      throw new NotFoundException('Active addressed invite not found');
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: invite.project.ownerId },
      include: { subscription: true },
    });
    const plan = owner?.subscription;
    const features = (plan?.features ?? {}) as Record<string, unknown>;
    if (!features.collaboration) {
      throw new ForbiddenException(
        'Collaboration is not available on current plan',
      );
    }
    if (plan?.maxCollaboratorsPerProject != null) {
      const membersCount = await this.prisma.projectMember.count({
        where: { projectId: invite.projectId },
      });
      if (membersCount >= plan.maxCollaboratorsPerProject) {
        throw new ForbiddenException(
          'Collaborator limit reached for this project',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const accepted = await tx.projectInvite.updateMany({
        where: {
          id: invite.id,
          email: myEmail,
          acceptedAt: null,
          declinedAt: null,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: { acceptedAt: now },
      });
      if (accepted.count !== 1) {
        throw new BadRequestException('Invite is no longer active');
      }

      const existing = await tx.projectMember.findUnique({
        where: {
          projectId_userId: { projectId: invite.projectId, userId },
        },
      });
      if (!existing) {
        await tx.projectMember.create({
          data: {
            projectId: invite.projectId,
            userId,
            role: invite.role,
          },
        });
      }
    });

    return this.getProjectBySlug(userId, invite.project.slug);
  }

  async declineAddressedInvite(userId: string, userEmail: string, inviteId: string) {
    const myEmail = normalizeEmail(userEmail);
    const now = new Date();
    const declined = await this.prisma.projectInvite.updateMany({
      where: {
        id: inviteId,
        email: myEmail,
        acceptedAt: null,
        declinedAt: null,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { declinedAt: now },
    });
    if (declined.count !== 1) {
      throw new NotFoundException('Active addressed invite not found');
    }
    return { ok: true };
  }

  /** Список участников. Владелец — Project.ownerId. */
  async getProjectMembers(userId: string, slug: string) {
    const access = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'manageMembers',
    );
    const project = await this.prisma.project.findUnique({
      where: { id: access.project.id },
      select: {
        id: true,
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
    if (!project) throw new NotFoundException('Project not found');

    const owner = project.owner;
    const ownerEmail = owner?.email?.trim().toLowerCase() ?? '';
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
      owner: owner?.email
        ? {
            id: owner.id,
            email: owner.email,
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

  async transferOwnership(
    userId: string,
    slug: string,
    dto: { userId: string },
  ) {
    const access = await this.projectAccess.assertBySlug(userId, slug, 'owner');
    const targetUserId = String(dto?.userId ?? '').trim();
    if (!targetUserId) {
      throw new BadRequestException('userId is required');
    }
    if (targetUserId === access.project.ownerId) {
      throw new BadRequestException('Already the project owner');
    }

    const targetAccess = await this.projectAccess.resolveById(
      targetUserId,
      access.project.id,
    );
    if (!targetAccess.capabilities.read) {
      throw new BadRequestException(
        'Target user must already have access to the project',
      );
    }

    const targetExists = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!targetExists) throw new NotFoundException('User not found');

    await this.prisma.project.update({
      where: { id: access.project.id },
      data: { ownerId: targetUserId },
    });

    return { ok: true, ownerId: targetUserId };
  }

  /** Изменить роль участника может администратор пространства. */
  async updateMemberRole(
    userId: string,
    slug: string,
    memberId: string,
    dto: { role: string },
  ) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'manageMembers',
    );
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

  /** Удалить участника может администратор пространства. */
  async removeMember(userId: string, slug: string, memberId: string) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'manageMembers',
    );
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

  private projectTeamRoleInclude() {
    return {
      assignments: {
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }

  private async buildEmailProfileMap(emails: string[]) {
    const uniqueEmails = [
      ...new Set(
        emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    if (uniqueEmails.length === 0) {
      return new Map<
        string,
        {
          email: string;
          displayName: string | null;
          firstName: string | null;
          lastName: string | null;
          avatarUrl: string | null;
        }
      >();
    }
    const profiles = await this.prisma.userProfile.findMany({
      where: { email: { in: uniqueEmails } },
      select: {
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });
    return new Map(
      profiles.map((profile) => [profile.email.trim().toLowerCase(), profile]),
    );
  }

  private async formatProjectTeamRoles(
    roles: Array<{
      id: string;
      projectId: string;
      slug: string;
      title: string;
      parentId: string | null;
      sortOrder: number;
      description: string;
      avatarKey: string | null;
      createdAt: Date;
      updatedAt: Date;
      assignments: Array<{ id: string; email: string; createdAt: Date }>;
    }>,
  ) {
    const profileByEmail = await this.buildEmailProfileMap(
      roles.flatMap((role) => role.assignments.map((item) => item.email)),
    );
    return roles.map((role) => {
      const assignees = role.assignments.map((assignment) => {
        const email = assignment.email.trim().toLowerCase();
        const profile = profileByEmail.get(email) ?? null;
        return {
          id: assignment.id,
          email,
          profile,
        };
      });
      return {
        id: role.id,
        projectId: role.projectId,
        slug: role.slug,
        title: role.title,
        parentId: role.parentId,
        sortOrder: role.sortOrder,
        description: role.description,
        avatarKey: role.avatarKey,
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
        assignmentCount: assignees.length,
        assignees,
        assignments: role.assignments.map((assignment) => ({
          id: assignment.id,
          email: assignment.email.trim().toLowerCase(),
          createdAt: assignment.createdAt.toISOString(),
          assignee: assignees.find((item) => item.id === assignment.id)!,
        })),
      };
    });
  }

  async getProductionTeam(userId: string, slug: string) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'read',
    );
    const link = await this.prisma.projectTheater.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
      select: {
        theater: { select: { id: true, title: true } },
      },
    });
    let theater: { id: string; title: string } | null = null;
    let theaterRoles: Awaited<
      ReturnType<TroupeService['listTeamRolesForTroupe']>
    > = [];
    if (link?.theater) {
      const payload = await this.troupeService.getTheaterHomeTeamRoles(
        link.theater.id,
      );
      theater = payload.theater;
      theaterRoles = payload.roles;
    }
    const projectRoles = await this.listProjectTeamRoles(project.id);
    return { theater, theaterRoles, projectRoles };
  }

  private async listProjectTeamRoles(projectId: string) {
    const roles = await this.prisma.projectTeamRole.findMany({
      where: { projectId },
      include: this.projectTeamRoleInclude(),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return this.formatProjectTeamRoles(roles);
  }

  async getProjectTeamRoles(userId: string, slug: string) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'read',
    );
    return this.listProjectTeamRoles(project.id);
  }

  async getProjectTeamRole(userId: string, slug: string, roleId: string) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'read',
    );
    const role = await this.prisma.projectTeamRole.findFirst({
      where: { id: String(roleId ?? '').trim(), projectId: project.id },
      include: this.projectTeamRoleInclude(),
    });
    if (!role) throw new NotFoundException('Project team role not found');
    const [formatted] = await this.formatProjectTeamRoles([role]);
    return formatted;
  }

  async createProjectTeamRole(userId: string, slug: string, body: unknown) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'write',
    );
    const dto = (body ?? {}) as {
      title?: unknown;
      parentId?: unknown;
      sortOrder?: unknown;
      description?: unknown;
    };
    const title = String(dto.title ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!title) throw new BadRequestException('title is required');
    const parentId =
      typeof dto.parentId === 'string' && dto.parentId.trim()
        ? dto.parentId.trim()
        : null;
    if (parentId) {
      const parent = await this.prisma.projectTeamRole.findFirst({
        where: { id: parentId, projectId: project.id },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException('Parent role not found');
    }
    const baseSlug = slugifyRoleTitle(title);
    let slugValue = baseSlug;
    let i = 2;
    while (
      await this.prisma.projectTeamRole.findUnique({
        where: {
          projectId_slug: { projectId: project.id, slug: slugValue },
        },
        select: { id: true },
      })
    ) {
      slugValue = `${baseSlug}-${i}`;
      i += 1;
    }
    const role = await this.prisma.projectTeamRole.create({
      data: {
        projectId: project.id,
        slug: slugValue,
        title,
        parentId,
        sortOrder:
          typeof dto.sortOrder === 'number' && Number.isFinite(dto.sortOrder)
            ? dto.sortOrder
            : 100,
        description: String(dto.description ?? '').trim(),
      },
      include: this.projectTeamRoleInclude(),
    });
    await touchProjectActivity(this.prisma, project.id);
    const [formatted] = await this.formatProjectTeamRoles([role]);
    return formatted;
  }

  async updateProjectTeamRole(
    userId: string,
    slug: string,
    roleId: string,
    body: unknown,
  ) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'write',
    );
    const id = String(roleId ?? '').trim();
    if (!id) throw new BadRequestException('roleId is required');
    const existing = await this.prisma.projectTeamRole.findFirst({
      where: { id, projectId: project.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Project team role not found');
    const dto = (body ?? {}) as {
      title?: unknown;
      parentId?: unknown;
      sortOrder?: unknown;
      description?: unknown;
      avatarKey?: unknown;
    };
    const nextParentId =
      typeof dto.parentId === 'string'
        ? dto.parentId.trim() || null
        : dto.parentId === null
          ? null
          : undefined;
    if (nextParentId) {
      if (nextParentId === id) {
        throw new BadRequestException('Role cannot be parent of itself');
      }
      const parent = await this.prisma.projectTeamRole.findFirst({
        where: { id: nextParentId, projectId: project.id },
        select: { id: true, parentId: true },
      });
      if (!parent) throw new NotFoundException('Parent role not found');
      let cursorParentId = parent.parentId;
      while (cursorParentId) {
        if (cursorParentId === id) {
          throw new BadRequestException('Role cannot be moved under its child');
        }
        const ancestor = await this.prisma.projectTeamRole.findFirst({
          where: { id: cursorParentId, projectId: project.id },
          select: { parentId: true },
        });
        cursorParentId = ancestor?.parentId ?? null;
      }
    }
    const data: Prisma.ProjectTeamRoleUpdateInput = {};
    if (typeof dto.title === 'string') {
      const title = dto.title.trim().replace(/\s+/g, ' ');
      if (!title) throw new BadRequestException('title is required');
      data.title = title;
    }
    if (nextParentId !== undefined) {
      data.parent = nextParentId
        ? { connect: { id: nextParentId } }
        : { disconnect: true };
    }
    if (typeof dto.sortOrder === 'number' && Number.isFinite(dto.sortOrder)) {
      data.sortOrder = dto.sortOrder;
    }
    if (typeof dto.description === 'string') {
      data.description = dto.description.trim();
    }
    if (dto.avatarKey === null) {
      data.avatarKey = null;
    } else if (typeof dto.avatarKey === 'string') {
      data.avatarKey = dto.avatarKey.trim() || null;
    }
    const role = await this.prisma.projectTeamRole.update({
      where: { id },
      data,
      include: this.projectTeamRoleInclude(),
    });
    await touchProjectActivity(this.prisma, project.id);
    const [formatted] = await this.formatProjectTeamRoles([role]);
    return formatted;
  }

  async removeProjectTeamRole(userId: string, slug: string, roleId: string) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'write',
    );
    const id = String(roleId ?? '').trim();
    if (!id) throw new BadRequestException('roleId is required');
    const res = await this.prisma.projectTeamRole.deleteMany({
      where: { id, projectId: project.id },
    });
    if (res.count === 0) {
      throw new NotFoundException('Project team role not found');
    }
    await touchProjectActivity(this.prisma, project.id);
    return { ok: true };
  }

  async addProjectTeamRoleAssignment(
    userId: string,
    slug: string,
    roleId: string,
    rawEmail: unknown,
  ) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'write',
    );
    const id = String(roleId ?? '').trim();
    if (!id) throw new BadRequestException('roleId is required');
    const role = await this.prisma.projectTeamRole.findFirst({
      where: { id, projectId: project.id },
      select: { id: true },
    });
    if (!role) throw new NotFoundException('Project team role not found');
    const email = normalizeEmail(String(rawEmail ?? ''));
    if (!email || !email.includes('@')) {
      throw new BadRequestException('email is required');
    }
    try {
      await this.prisma.projectTeamRoleAssignment.create({
        data: { roleId: role.id, email },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // already assigned
      } else {
        throw error;
      }
    }
    await touchProjectActivity(this.prisma, project.id);
    return this.getProjectTeamRole(userId, slug, role.id);
  }

  async removeProjectTeamRoleAssignment(
    userId: string,
    slug: string,
    roleId: string,
    assignmentId: string,
  ) {
    const { project } = await this.projectAccess.assertBySlug(
      userId,
      slug,
      'write',
    );
    const id = String(roleId ?? '').trim();
    const assignment = String(assignmentId ?? '').trim();
    if (!id || !assignment) {
      throw new BadRequestException('roleId and assignmentId are required');
    }
    const role = await this.prisma.projectTeamRole.findFirst({
      where: { id, projectId: project.id },
      select: { id: true },
    });
    if (!role) throw new NotFoundException('Project team role not found');
    const res = await this.prisma.projectTeamRoleAssignment.deleteMany({
      where: { id: assignment, roleId: role.id },
    });
    if (res.count === 0) throw new NotFoundException('Assignment not found');
    await touchProjectActivity(this.prisma, project.id);
    return this.getProjectTeamRole(userId, slug, role.id);
  }
}
