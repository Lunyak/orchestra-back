import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../project-access/project-access.service';
import { ProjectsService } from './projects.service';

describe('project addressed invites', () => {
  it('creates a pending invite instead of a project member', async () => {
    const project = {
      id: 'project-1',
      slug: 'show',
      name: 'Show',
      ownerId: 'owner-1',
    };
    const create = jest.fn().mockResolvedValue({
      id: 'invite-1',
      role: 'editor',
      email: 'person@example.com',
      expiresAt: null,
    });
    const prisma = {
      project: { findUniqueOrThrow: jest.fn().mockResolvedValue(project) },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'owner-1',
            subscription: {
              features: { collaboration: true },
              maxCollaboratorsPerProject: null,
            },
          })
          .mockResolvedValueOnce({ id: 'user-2' }),
      },
      projectMember: {
        count: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      projectInvite: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    } as unknown as PrismaService;
    const projectAccess = {
      assertBySlug: jest.fn().mockResolvedValue({ project }),
    } as unknown as ProjectAccessService;
    const service = new ProjectsService(
      prisma,
      {} as never,
      {} as never,
      {} as never,
      projectAccess,
      {} as never,
    );

    const result = await service.inviteByEmail('owner-1', 'show', {
      email: 'Person@Example.com',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'project-1',
          email: 'person@example.com',
          role: 'editor',
          createdByUserId: 'owner-1',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'invite-1',
        email: 'person@example.com',
        invitePath: expect.stringMatching(/^\/projects\/invite\//),
      }),
    );
  });

  it('rejects a second active invite for the same email', async () => {
    const project = {
      id: 'project-1',
      slug: 'show',
      name: 'Show',
      ownerId: 'owner-1',
    };
    const prisma = {
      project: { findUniqueOrThrow: jest.fn().mockResolvedValue(project) },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'owner-1',
            subscription: {
              features: { collaboration: true },
              maxCollaboratorsPerProject: null,
            },
          })
          .mockResolvedValueOnce(null),
      },
      projectMember: {
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      projectInvite: {
        findFirst: jest.fn().mockResolvedValue({ id: 'invite-1' }),
        create: jest.fn(),
      },
    } as unknown as PrismaService;
    const projectAccess = {
      assertBySlug: jest.fn().mockResolvedValue({ project }),
    } as unknown as ProjectAccessService;
    const service = new ProjectsService(
      prisma,
      {} as never,
      {} as never,
      {} as never,
      projectAccess,
      {} as never,
    );

    await expect(
      service.inviteByEmail('owner-1', 'show', {
        email: 'person@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('declines an addressed invite by email', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      projectInvite: { updateMany },
    } as unknown as PrismaService;
    const service = new ProjectsService(
      prisma,
      {} as never,
      {} as never,
      {} as never,
      {} as ProjectAccessService,
      {} as never,
    );

    await expect(
      service.declineAddressedInvite(
        'user-1',
        'person@example.com',
        'invite-1',
      ),
    ).resolves.toEqual({ ok: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'invite-1',
        email: 'person@example.com',
        declinedAt: null,
      }),
      data: { declinedAt: expect.any(Date) },
    });
  });

  it('returns not found when decline misses an active invite', async () => {
    const prisma = {
      projectInvite: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    } as unknown as PrismaService;
    const service = new ProjectsService(
      prisma,
      {} as never,
      {} as never,
      {} as never,
      {} as ProjectAccessService,
      {} as never,
    );

    await expect(
      service.declineAddressedInvite(
        'user-1',
        'person@example.com',
        'invite-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
