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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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

    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      include: { subscription: true },
    });
    const plan = owner?.subscription;

    const features = (plan?.features ?? {}) as any;

    if (!features.collaboration) {
      throw new ForbiddenException('Collaboration is not available on current plan');
    }

    if (plan?.maxCollaboratorsPerProject != null) {
      const membersCount = await this.prisma.projectMember.count({
        where: { projectId: project.id },
      });
      if (membersCount >= plan.maxCollaboratorsPerProject) {
        throw new ForbiddenException('Collaborator limit reached for this project');
      }
    }

    const role = dto.role ?? 'editor';

    return this.prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: dto.userId,
        role,
      },
    });
  }

  /** Пригласить в проект по email — только владелец. Пользователь с email должен быть зарегистрирован. */
  async inviteByEmail(userId: string, slug: string, dto: InviteByEmailDto) {
    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
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
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user) {
      throw new NotFoundException('Пользователь с таким email не найден');
    }
    const role = dto.role ?? 'editor';
    return this.prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role,
      },
    });
  }

  /** Список участников проекта — только владелец может просматривать. */
  async getProjectMembers(userId: string, slug: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        ownerId: true,
        members: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, email: true } },
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
    return {
      id: project.id,
      members: project.members,
    };
  }
}

