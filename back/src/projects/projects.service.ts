import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
    const user = await this.prisma.user.findUnique({
      where: { id: ownerId },
      include: { subscription: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const plan = user.subscription;
    // Проверяем лимит только если он явно установлен и больше 0
    if (plan?.maxProjects != null && plan.maxProjects > 0) {
      const count = await this.prisma.project.count({
        where: { ownerId },
      });
      if (count >= plan.maxProjects) {
        throw new ForbiddenException('Project limit reached for current plan');
      }
    }

    return this.prisma.project.create({
      data: {
        slug: dto.slug,
        name: dto.name ?? dto.slug,
        description: dto.description ?? null,
        ownerId,
      },
    });
  }

  async addMember(ownerId: string, slug: string, dto: AddMemberDto) {
    const project = await this.prisma.project.findFirst({
      where: { slug, ownerId },
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

