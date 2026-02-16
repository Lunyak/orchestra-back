import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        createdAt: true,
        subscriptionId: true,
        subscription: {
          select: {
            id: true,
            name: true,
            maxProjects: true,
            maxCollaboratorsPerProject: true,
          },
        },
        _count: { select: { projectsOwned: true } },
      },
    });
  }

  async getProjects() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, email: true } },
      },
    });
  }

  async getPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        maxProjects: true,
        maxCollaboratorsPerProject: true,
      },
    });
  }

  async setUserSubscription(userId: string, subscriptionId: string | null) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (subscriptionId) {
      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: subscriptionId },
      });
      if (!plan) throw new NotFoundException('Subscription plan not found');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionId },
      select: {
        id: true,
        email: true,
        subscriptionId: true,
        subscription: {
          select: { id: true, name: true, maxProjects: true },
        },
      },
    });
  }

  async setProjectDeleted(projectId: string, deleted: boolean) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: deleted ? new Date() : null },
    });
  }
}
