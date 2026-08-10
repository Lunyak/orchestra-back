import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkspaceRole, WorkspaceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ProjectCapability =
  | 'read'
  | 'write'
  | 'manageMembers'
  | 'owner'
  | 'admin';

export interface ProjectCapabilities {
  read: boolean;
  write: boolean;
  manageMembers: boolean;
  owner: boolean;
  admin: boolean;
}

export interface ProjectAccess {
  project: {
    id: string;
    slug: string;
    name: string;
    workspaceId: string;
    workspaceType: WorkspaceType;
    ownerId: string;
  };
  workspaceRole: WorkspaceRole | null;
  projectRole: string | null;
  capabilities: ProjectCapabilities;
}

export function resolveProjectCapabilities(
  workspaceRole: WorkspaceRole | null,
  projectRole: string | null,
  isProjectOwner = false,
): ProjectCapabilities {
  const owner = isProjectOwner;
  const admin =
    owner || workspaceRole === 'OWNER' || workspaceRole === 'ADMIN';
  const workspaceMember = workspaceRole === 'MEMBER';
  const projectEditor = projectRole === 'editor';
  const projectViewer = projectRole === 'viewer';
  const read =
    admin || workspaceMember || projectEditor || projectViewer || owner;
  const write = admin || workspaceMember || projectEditor;

  return {
    read,
    write,
    manageMembers: admin,
    owner,
    admin,
  };
}

@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  readWhere(userId: string): Prisma.ProjectWhereInput {
    return {
      deletedAt: null,
      OR: [
        { ownerId: userId },
        { workspace: { memberships: { some: { userId } } } },
        { members: { some: { userId } } },
      ],
    };
  }

  async resolveBySlug(userId: string, slug: string): Promise<ProjectAccess> {
    const project = await this.prisma.project.findFirst({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        workspaceId: true,
        ownerId: true,
        workspace: {
          select: {
            type: true,
            memberships: {
              where: { userId },
              select: { role: true },
              take: 1,
            },
          },
        },
        members: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.toAccess(userId, project);
  }

  async resolveById(userId: string, projectId: string): Promise<ProjectAccess> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        workspaceId: true,
        ownerId: true,
        workspace: {
          select: {
            type: true,
            memberships: {
              where: { userId },
              select: { role: true },
              take: 1,
            },
          },
        },
        members: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.toAccess(userId, project);
  }

  async assertBySlug(
    userId: string,
    slug: string,
    capability: ProjectCapability,
  ): Promise<ProjectAccess> {
    const access = await this.resolveBySlug(userId, slug);
    this.assertCapability(access, capability);
    return access;
  }

  async assertById(
    userId: string,
    projectId: string,
    capability: ProjectCapability,
  ): Promise<ProjectAccess> {
    const access = await this.resolveById(userId, projectId);
    this.assertCapability(access, capability);
    return access;
  }

  private assertCapability(
    access: ProjectAccess,
    capability: ProjectCapability,
  ) {
    if (!access.capabilities[capability]) {
      throw new ForbiddenException(`No ${capability} access to project`);
    }
  }

  private toAccess(
    userId: string,
    project: {
      id: string;
      slug: string;
      name: string;
      workspaceId: string;
      ownerId: string;
      workspace: {
        type: WorkspaceType;
        memberships: Array<{ role: WorkspaceRole }>;
      };
      members: Array<{ role: string }>;
    },
  ): ProjectAccess {
    const workspaceRole = project.workspace.memberships[0]?.role ?? null;
    const projectRole = project.members[0]?.role ?? null;
    const isProjectOwner = project.ownerId === userId;
    return {
      project: {
        id: project.id,
        slug: project.slug,
        name: project.name,
        workspaceId: project.workspaceId,
        workspaceType: project.workspace.type,
        ownerId: project.ownerId,
      },
      workspaceRole,
      projectRole,
      capabilities: resolveProjectCapabilities(
        workspaceRole,
        projectRole,
        isProjectOwner,
      ),
    };
  }
}
