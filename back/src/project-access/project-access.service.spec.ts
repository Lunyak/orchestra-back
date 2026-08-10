import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole, WorkspaceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import {
  ProjectAccessService,
  resolveProjectCapabilities,
} from './project-access.service';

describe('project access capabilities', () => {
  const workspaceTypes: WorkspaceType[] = ['PERSONAL', 'THEATER', 'TROUPE'];

  it('project owner has full access regardless of workspace role', () => {
    expect(resolveProjectCapabilities(null, 'editor', true)).toEqual({
      read: true,
      write: true,
      manageMembers: true,
      owner: true,
      admin: true,
    });
  });

  it.each(workspaceTypes)('%s OWNER is admin but not project owner', () => {
    expect(resolveProjectCapabilities('OWNER', null, false)).toEqual({
      read: true,
      write: true,
      manageMembers: true,
      owner: false,
      admin: true,
    });
  });

  it.each(workspaceTypes)('%s ADMIN manages but does not own', () => {
    expect(resolveProjectCapabilities('ADMIN', null)).toEqual({
      read: true,
      write: true,
      manageMembers: true,
      owner: false,
      admin: true,
    });
  });

  it.each(workspaceTypes)('%s MEMBER reads and writes', () => {
    expect(resolveProjectCapabilities('MEMBER', null)).toEqual({
      read: true,
      write: true,
      manageMembers: false,
      owner: false,
      admin: false,
    });
  });

  it('project editor reads and writes without workspace membership', () => {
    expect(resolveProjectCapabilities(null, 'editor')).toEqual({
      read: true,
      write: true,
      manageMembers: false,
      owner: false,
      admin: false,
    });
  });

  it('project viewer only reads without workspace membership', () => {
    expect(resolveProjectCapabilities(null, 'viewer')).toEqual({
      read: true,
      write: false,
      manageMembers: false,
      owner: false,
      admin: false,
    });
  });

  it('resolves owner from Project.ownerId', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'project-1',
      slug: 'show',
      name: 'Show',
      workspaceId: 'workspace-1',
      ownerId: 'owner-1',
      workspace: {
        type: 'PERSONAL' as WorkspaceType,
        memberships: [] as Array<{ role: WorkspaceRole }>,
      },
      members: [{ role: 'editor' }],
    });
    const prisma = {
      project: { findFirst },
    } as unknown as PrismaService;
    const service = new ProjectAccessService(prisma);

    const access = await service.resolveBySlug('owner-1', 'show');

    expect(access.capabilities.owner).toBe(true);
    expect(access.capabilities.admin).toBe(true);
    expect(access.project.ownerId).toBe('owner-1');
  });

  it('linked theater or troupe does not grant project access', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'project-1',
      slug: 'linked-project',
      name: 'Linked project',
      workspaceId: 'workspace-1',
      ownerId: 'other-owner',
      workspace: {
        type: 'PERSONAL' as WorkspaceType,
        memberships: [] as Array<{ role: WorkspaceRole }>,
      },
      members: [],
    });
    const prisma = {
      project: { findFirst },
    } as unknown as PrismaService;
    const service = new ProjectAccessService(prisma);

    const access = await service.resolveBySlug('linked-user', 'linked-project');

    expect(access.capabilities).toEqual({
      read: false,
      write: false,
      manageMembers: false,
      owner: false,
      admin: false,
    });
    await expect(
      service.assertBySlug('linked-user', 'linked-project', 'read'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          theaters: expect.anything(),
          troupes: expect.anything(),
        }),
      }),
    );
  });
});

describe('project organization links', () => {
  it('creates theater links without changing workspace or legacy owner', async () => {
    const projectUpdate = jest.fn();
    const projectTheaterUpsert = jest.fn().mockResolvedValue({ id: 'pt-1' });
    const prismaMock = {
      project: { update: projectUpdate },
      theater: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'theater-1',
          workspaceId: 'theater-workspace-1',
        }),
      },
      projectTheater: { upsert: projectTheaterUpsert },
      rehearsal: { findMany: jest.fn().mockResolvedValue([]) },
      rehearsalWorkspace: { createMany: jest.fn() },
    };
    const prisma = {
      ...prismaMock,
      $transaction: jest.fn(
        (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
      ),
    } as unknown as PrismaService;
    const projectAccess = {
      assertBySlug: jest.fn().mockResolvedValue({
        project: {
          id: 'project-1',
          workspaceId: 'workspace-1',
        },
      }),
    };
    const service = new ProjectsService(
      prisma,
      {} as never,
      {} as never,
      {} as never,
      projectAccess as never,
      {} as never,
    );

    await service.linkTheater('admin-1', 'project', 'theater-1');

    expect(projectUpdate).not.toHaveBeenCalled();
    expect(projectTheaterUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ projectId: 'project-1' }),
      }),
    );
  });
});
