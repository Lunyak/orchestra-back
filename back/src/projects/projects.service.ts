import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateProjectDto {
  slug: string;
  name?: string;
  description?: string;
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
  constructor(private readonly prisma: PrismaService) {}

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
        scenes: {
          include: {
            playlist: true,
            sounds: true,
            steps: {
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
