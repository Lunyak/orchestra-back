import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';

function createService(prisma: unknown, projectAccess: unknown) {
  return new ProjectsService(
    prisma as PrismaService,
    {} as never,
    {} as never,
    {} as never,
    projectAccess as never,
    {} as never,
  );
}

describe('updateProject', () => {
  it('requires owner access', async () => {
    const projectAccess = {
      assertBySlug: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('No owner access')),
    };
    const prisma = {
      project: { update: jest.fn(), findUnique: jest.fn() },
    };
    const service = createService(prisma, projectAccess);

    await expect(
      service.updateProject('editor-1', 'show', { name: 'New name' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(projectAccess.assertBySlug).toHaveBeenCalledWith(
      'editor-1',
      'show',
      'owner',
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('updates name for the project owner', async () => {
    const projectUpdate = jest.fn().mockResolvedValue({
      id: 'project-1',
      slug: 'show',
      name: 'New name',
      description: null,
    });
    const prisma = {
      project: { update: projectUpdate, findUnique: jest.fn() },
    };
    const projectAccess = {
      assertBySlug: jest.fn().mockResolvedValue({
        project: { id: 'project-1', slug: 'show', ownerId: 'owner-1' },
      }),
    };
    const service = createService(prisma, projectAccess);

    const result = await service.updateProject('owner-1', 'show', {
      name: 'New name',
    });

    expect(projectAccess.assertBySlug).toHaveBeenCalledWith(
      'owner-1',
      'show',
      'owner',
    );
    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { name: 'New name' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
      },
    });
    expect(result).toEqual({
      id: 'project-1',
      slug: 'show',
      name: 'New name',
      description: null,
    });
  });
});

describe('transferOwnership', () => {
  it('updates Project.ownerId for an eligible member', async () => {
    const projectUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'member-1' }) },
      project: { update: projectUpdate },
    };
    const projectAccess = {
      assertBySlug: jest.fn().mockResolvedValue({
        project: { id: 'project-1', ownerId: 'owner-1' },
      }),
      resolveById: jest.fn().mockResolvedValue({
        capabilities: { read: true },
      }),
    };
    const service = createService(prisma, projectAccess);

    const result = await service.transferOwnership('owner-1', 'show', {
      userId: 'member-1',
    });

    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { ownerId: 'member-1' },
    });
    expect(result).toEqual({ ok: true, ownerId: 'member-1' });
  });

  it('rejects transfer to a user without project access', async () => {
    const prisma = {
      user: { findUnique: jest.fn() },
      project: { update: jest.fn() },
    };
    const projectAccess = {
      assertBySlug: jest.fn().mockResolvedValue({
        project: { id: 'project-1', ownerId: 'owner-1' },
      }),
      resolveById: jest.fn().mockResolvedValue({
        capabilities: { read: false },
      }),
    };
    const service = createService(prisma, projectAccess);

    await expect(
      service.transferOwnership('owner-1', 'show', { userId: 'stranger' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('rejects non-owner callers via assertBySlug', async () => {
    const projectAccess = {
      assertBySlug: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('No owner access')),
    };
    const service = createService({}, projectAccess);

    await expect(
      service.transferOwnership('admin-1', 'show', { userId: 'member-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('project theater invites', () => {
  it('creates an invite with hashed token', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'invite-1',
      expiresAt: new Date('2030-01-01'),
    });
    const prisma = {
      projectTheaterInvite: { create },
    };
    const projectAccess = {
      assertBySlug: jest.fn().mockResolvedValue({
        project: { id: 'project-1' },
      }),
    };
    const service = createService(prisma, projectAccess);

    const result = await service.createTheaterInvite('owner-1', 'show');

    expect(projectAccess.assertBySlug).toHaveBeenCalledWith(
      'owner-1',
      'show',
      'owner',
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'project-1',
          createdByUserId: 'owner-1',
          tokenHash: expect.any(String),
        }),
      }),
    );
    expect(result.id).toBe('invite-1');
    expect(result.token).toEqual(expect.any(String));
    expect(result.invitePath).toMatch(/^\/projects\/theater-invite\//);
  });

  it('accepts invite by theater admin and links project', async () => {
    const projectTheaterUpsert = jest.fn().mockResolvedValue({ id: 'pt-1' });
    const inviteUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prismaMock = {
      projectTheaterInvite: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'invite-1',
          projectId: 'project-1',
          project: { slug: 'show' },
        }),
        updateMany: inviteUpdateMany,
      },
      theater: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'theater-1',
          workspaceId: 'tw-1',
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
    };
    const service = createService(prisma, {});

    const result = await service.acceptTheaterInvite('admin-1', 'raw-token', {
      theaterId: 'theater-1',
    });

    expect(inviteUpdateMany).toHaveBeenCalled();
    expect(projectTheaterUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          projectId: 'project-1',
          theaterId: 'theater-1',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        projectSlug: 'show',
        theaterId: 'theater-1',
      }),
    );
  });

  it('rejects accept when caller cannot admin the theater', async () => {
    const prisma = {
      projectTheaterInvite: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'invite-1',
          projectId: 'project-1',
          project: { slug: 'show' },
        }),
      },
      theater: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    const service = createService(prisma, {});

    await expect(
      service.acceptTheaterInvite('user-1', 'raw-token', {
        theaterId: 'theater-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('revokes an active invite', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      projectTheaterInvite: { updateMany },
    };
    const projectAccess = {
      assertBySlug: jest.fn().mockResolvedValue({
        project: { id: 'project-1' },
      }),
    };
    const service = createService(prisma, projectAccess);

    await expect(
      service.revokeTheaterInvite('owner-1', 'show', 'invite-1'),
    ).resolves.toEqual({ ok: true });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'invite-1',
          projectId: 'project-1',
        }),
      }),
    );
  });

  it('returns not found when revoke misses', async () => {
    const prisma = {
      projectTheaterInvite: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const projectAccess = {
      assertBySlug: jest.fn().mockResolvedValue({
        project: { id: 'project-1' },
      }),
    };
    const service = createService(prisma, projectAccess);

    await expect(
      service.revokeTheaterInvite('owner-1', 'show', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects double-accept race', async () => {
    const prismaMock = {
      projectTheaterInvite: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'invite-1',
          projectId: 'project-1',
          project: { slug: 'show' },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      theater: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'theater-1',
          workspaceId: 'tw-1',
        }),
      },
      projectTheater: { upsert: jest.fn() },
      rehearsal: { findMany: jest.fn() },
      rehearsalWorkspace: { createMany: jest.fn() },
    };
    const prisma = {
      ...prismaMock,
      $transaction: jest.fn(
        (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
      ),
    };
    const service = createService(prisma, {});

    await expect(
      service.acceptTheaterInvite('admin-1', 'raw-token', {
        theaterId: 'theater-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
