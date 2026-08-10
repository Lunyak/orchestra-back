import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../project-access/project-access.service';
import { DashboardService } from './dashboard.service';

function createPrismaMock() {
  return {
    project: { findMany: jest.fn().mockResolvedValue([]) },
    rehearsal: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    projectTask: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    studioInvite: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    projectInvite: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    troupeInvite: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    studioAssignment: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    directorSession: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
}

describe('DashboardService', () => {
  it('uses ProjectAccessService.readWhere for every project-backed query', async () => {
    const prisma = createPrismaMock();
    const readWhere = {
      deletedAt: null,
      OR: [
        { workspace: { memberships: { some: { userId: 'user-1' } } } },
        { members: { some: { userId: 'user-1' } } },
      ],
    };
    const projectAccess = {
      readWhere: jest.fn().mockReturnValue(readWhere),
    };
    const service = new DashboardService(
      prisma as unknown as PrismaService,
      projectAccess as unknown as ProjectAccessService,
    );

    await service.getDashboard('user-1', 'Person@Example.com');

    expect(projectAccess.readWhere).toHaveBeenCalledWith('user-1');
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: readWhere }),
    );
    const rehearsalCalls = prisma.rehearsal.findMany.mock.calls;
    expect(rehearsalCalls).toHaveLength(2);
    for (const [query] of rehearsalCalls) {
      expect(query.where.project).toEqual({ is: readWhere });
    }
    expect(prisma.projectTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ project: { is: readWhere } }),
      }),
    );
  });

  it('normalizes email and applies active, incomplete and bounded filters', async () => {
    const prisma = createPrismaMock();
    const service = new DashboardService(
      prisma as unknown as PrismaService,
      {
        readWhere: jest.fn().mockReturnValue({ deletedAt: null }),
      } as unknown as ProjectAccessService,
    );

    const result = await service.getDashboard(
      'user-1',
      ' Person@Example.com ',
      {
        horizonDays: 500,
        rehearsalsLimit: 500,
        tasksLimit: 500,
        actionsLimit: 500,
      },
    );

    expect(result.horizonDays).toBe(90);
    expect(prisma.rehearsal.findMany.mock.calls[0][0].take).toBe(20);
    expect(prisma.projectTask.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        take: 30,
        where: expect.objectContaining({
          assigneeEmail: 'person@example.com',
          status: { not: 'done' },
        }),
      }),
    );
    expect(prisma.studioInvite.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        take: 30,
        where: expect.objectContaining({
          email: 'person@example.com',
          acceptedAt: null,
          declinedAt: null,
          revokedAt: null,
        }),
      }),
    );
    expect(prisma.projectInvite.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        take: 30,
        where: expect.objectContaining({
          email: 'person@example.com',
          acceptedAt: null,
          declinedAt: null,
          revokedAt: null,
        }),
      }),
    );
    expect(prisma.troupeInvite.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        take: 30,
        where: expect.objectContaining({
          email: 'person@example.com',
          acceptedAt: null,
          declinedAt: null,
          revokedAt: null,
        }),
      }),
    );
    expect(prisma.studioAssignment.findMany.mock.calls[0][0].where).toEqual({
      targets: { some: { email: 'person@example.com' } },
      submissions: { none: { email: 'person@example.com' } },
    });
  });

  it('aggregates unread chat with one set-based query', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'conversation-1',
        kind: 'TROUPE',
        troupeId: 'troupe-1',
        title: 'Труппа',
        unreadCount: 3n,
      },
      {
        id: 'conversation-2',
        kind: 'TROUPE',
        troupeId: 'troupe-2',
        title: 'Гастроли',
        unreadCount: 2,
      },
    ]);
    const service = new DashboardService(
      prisma as unknown as PrismaService,
      {
        readWhere: jest.fn().mockReturnValue({ deletedAt: null }),
      } as unknown as ProjectAccessService,
    );

    const result = await service.getDashboard('user-1', 'person@example.com');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.chat.totalUnread).toBe(5);
    expect(result.summary.unreadChat).toBe(5);
    expect(result.chat.conversations.map((item) => item.unreadCount)).toEqual([
      3, 2,
    ]);
  });

  it('returns an empty dashboard and only unknown published session invitations', async () => {
    const prisma = createPrismaMock();
    prisma.directorSession.findMany.mockResolvedValue([
      {
        id: 'session-unknown',
        title: 'Unknown',
        startsAt: new Date('2026-08-04T10:00:00.000Z'),
        payload: {
          id: 'session-unknown',
          title: 'Вызов',
          startsAt: '2026-08-04T10:00:00.000Z',
          publishedAt: '2026-08-03T10:00:00.000Z',
          participants: [{ email: 'person@example.com', status: 'unknown' }],
        },
      },
      {
        id: 'session-answered',
        title: 'Answered',
        startsAt: new Date('2026-08-04T11:00:00.000Z'),
        payload: {
          publishedAt: '2026-08-03T10:00:00.000Z',
          participants: [{ email: 'person@example.com', status: 'present' }],
        },
      },
    ]);
    const service = new DashboardService(
      prisma as unknown as PrismaService,
      {
        readWhere: jest.fn().mockReturnValue({ deletedAt: null }),
      } as unknown as ProjectAccessService,
    );

    const result = await service.getDashboard('user-1', 'person@example.com');

    expect(result.projects).toEqual([]);
    expect(result.rehearsals).toEqual([]);
    expect(result.tasks).toEqual([]);
    expect(result.actions).toEqual([
      expect.objectContaining({
        kind: 'director_session_invitation',
        id: 'session-unknown',
      }),
    ]);
    expect(result.summary.actions).toBe(1);
  });
});
