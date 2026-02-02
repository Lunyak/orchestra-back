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
    if (plan?.maxProjects != null) {
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
}

