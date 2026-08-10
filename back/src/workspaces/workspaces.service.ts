import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole, WorkspaceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensurePersonalWorkspace(userId: string) {
    return this.prisma.workspace.upsert({
      where: { personalOwnerId: userId },
      update: {},
      create: {
        type: WorkspaceType.PERSONAL,
        name: 'Личное пространство',
        personalOwnerId: userId,
        memberships: { create: { userId, role: WorkspaceRole.OWNER } },
      },
    });
  }

  async listCreateTargets(userId: string) {
    await this.ensurePersonalWorkspace(userId);
    return this.prisma.workspace.findMany({
      where: {
        memberships: {
          some: { userId, role: { in: ['OWNER', 'ADMIN'] } },
        },
      },
      select: {
        id: true,
        type: true,
        name: true,
        theater: { select: { id: true, title: true } },
        troupe: { select: { id: true, title: true, theaterId: true } },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async createTheater(userId: string, titleRaw: unknown) {
    const title = String(titleRaw ?? '').trim();
    if (!title) throw new BadRequestException('title is required');

    return this.prisma.$transaction(async (tx) => {
      const theater = await tx.theater.create({
        data: {
          title,
          workspace: {
            create: {
              type: WorkspaceType.THEATER,
              name: title,
              memberships: { create: { userId, role: WorkspaceRole.OWNER } },
            },
          },
        },
        select: { id: true, title: true, workspaceId: true },
      });

      const troupeTitle = 'Основная труппа';
      const troupe = await tx.troupe.create({
        data: {
          title: troupeTitle,
          theater: { connect: { id: theater.id } },
          owner: { connect: { id: userId } },
          workspace: {
            create: {
              type: WorkspaceType.TROUPE,
              name: `${title} — ${troupeTitle}`,
              memberships: { create: { userId, role: WorkspaceRole.OWNER } },
            },
          },
        },
        select: { id: true, title: true, workspaceId: true, theaterId: true },
      });

      await tx.theaterTroupe.create({
        data: {
          theaterId: theater.id,
          troupeId: troupe.id,
          participationType: 'HOME',
        },
      });

      return { ...theater, troupes: [troupe] };
    });
  }

  async createTroupe(
    userId: string,
    theaterIdRaw: unknown,
    titleRaw: unknown,
  ) {
    const theaterId = String(theaterIdRaw ?? '').trim();
    const title = String(titleRaw ?? '').trim() || 'Труппа';
    const theater = theaterId
      ? await this.assertTheaterAdmin(userId, theaterId).then(() =>
          this.prisma.theater.findUnique({
            where: { id: theaterId },
            select: { id: true, title: true },
          }),
        )
      : null;
    if (theaterId && !theater) throw new NotFoundException('Theater not found');

    return this.prisma.$transaction(async (tx) => {
      const troupe = await tx.troupe.create({
        data: {
          title,
          theater: theater ? { connect: { id: theater.id } } : undefined,
          owner: { connect: { id: userId } },
          workspace: {
            create: {
              type: WorkspaceType.TROUPE,
              name: theater ? `${theater.title} — ${title}` : title,
              memberships: { create: { userId, role: WorkspaceRole.OWNER } },
            },
          },
        },
        select: {
          id: true,
          title: true,
          workspaceId: true,
          theaterId: true,
        },
      });

      if (theater) {
        await tx.theaterTroupe.create({
          data: {
            theaterId: theater.id,
            troupeId: troupe.id,
            participationType: 'HOME',
          },
        });
      }

      return troupe;
    });
  }

  async listTheaters(userId: string) {
    return this.prisma.theater.findMany({
      where: {
        OR: [
          { workspace: { memberships: { some: { userId } } } },
          {
            troupes: {
              some: { troupe: { members: { some: { userId } } } },
            },
          },
          { homeTroupes: { some: { members: { some: { userId } } } } },
        ],
      },
      select: {
        id: true,
        title: true,
        workspaceId: true,
        premises: {
          select: {
            id: true,
            name: true,
            address: true,
            capacity: true,
          },
          orderBy: { name: 'asc' },
        },
        homeTroupes: {
          select: { id: true, title: true, workspaceId: true },
          orderBy: { title: 'asc' },
        },
        workspace: {
          select: {
            memberships: {
              where: { userId },
              select: { role: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { title: 'asc' },
    });
  }

  async listTroupes(userId: string) {
    return this.prisma.troupe.findMany({
      where: {
        OR: [
          { ownerUserId: userId },
          {
            workspace: {
              memberships: {
                some: { userId },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        workspaceId: true,
        theaterId: true,
        theater: { select: { id: true, title: true } },
      },
      orderBy: { title: 'asc' },
    });
  }

  private async assertTheaterAdmin(userId: string, theaterId: string) {
    const theater = await this.prisma.theater.findFirst({
      where: {
        id: theaterId,
        workspace: {
          memberships: {
            some: { userId, role: { in: ['OWNER', 'ADMIN'] } },
          },
        },
      },
      select: { id: true },
    });
    if (!theater) throw new ForbiddenException('Cannot manage this theater');
    return theater;
  }

  async listTheaterRehearsals(
    userId: string,
    theaterId: string,
    fromRaw?: string,
    toRaw?: string,
  ) {
    const theater = await this.prisma.theater.findFirst({
      where: {
        id: theaterId,
        OR: [
          { workspace: { memberships: { some: { userId } } } },
          {
            troupes: {
              some: { troupe: { members: { some: { userId } } } },
            },
          },
          { homeTroupes: { some: { members: { some: { userId } } } } },
        ],
      },
      select: {
        id: true,
        title: true,
        workspaceId: true,
        workspace: {
          select: {
            memberships: {
              where: { userId },
              select: { role: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!theater) throw new ForbiddenException('Cannot view this theater');

    const from = this.parseOptionalDate(fromRaw, 'from');
    const to = this.parseOptionalDate(toRaw, 'to');
    const startsAt = from || to ? { gte: from, lte: to } : undefined;
    const theaterRole =
      theater.workspace.memberships[0]?.role ?? WorkspaceRole.MEMBER;
    const canManageCalendar =
      theaterRole === WorkspaceRole.OWNER ||
      theaterRole === WorkspaceRole.ADMIN;
    const projects = await this.prisma.project.findMany({
      where: {
        deletedAt: null,
        OR: [
          { workspaceId: theater.workspaceId },
          { theaters: { some: { theaterId: theater.id } } },
        ],
      },
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    });
    const rehearsals = await this.prisma.rehearsal.findMany({
      where: {
        startsAt,
        publishedAt: canManageCalendar ? undefined : { not: null },
        workspaces: { some: { workspaceId: theater.workspaceId } },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        durationMin: true,
        place: true,
        publishedAt: true,
        createdVia: true,
        project: { select: { id: true, slug: true, name: true } },
        projects: {
          select: {
            project: { select: { id: true, slug: true, name: true } },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
    const calendarItems = rehearsals.map(
      ({ createdVia, projects, ...rehearsal }) => ({
        ...rehearsal,
        source:
          createdVia === 'director-session'
            ? ('director-session' as const)
            : ('rehearsal' as const),
        projects: projects.map(({ project }) => project),
      }),
    );

    return {
      theater: {
        id: theater.id,
        title: theater.title,
        myRole: theaterRole,
      },
      projects,
      rehearsals: calendarItems,
    };
  }

  private parseOptionalDate(value: string | undefined, field: string) {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be an ISO date`);
    }
    return date;
  }

  async createTheaterPremise(
    userId: string,
    theaterId: string,
    body: { name?: string; address?: string; capacity?: number },
  ) {
    await this.assertTheaterAdmin(userId, theaterId);
    const name = String(body?.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');
    return this.prisma.premise.create({
      data: {
        theaterId,
        name,
        kind: 'OWNED',
        address: body.address?.trim() || null,
        capacity: body.capacity ?? null,
      },
      select: {
        id: true,
        theaterId: true,
        name: true,
        address: true,
        capacity: true,
      },
    });
  }

  async linkTroupe(
    userId: string,
    theaterId: string,
    troupeId: string,
    participationTypeRaw?: unknown,
  ) {
    await this.assertTheaterAdmin(userId, theaterId);
    const troupe = await this.prisma.troupe.findFirst({
      where: {
        id: troupeId,
        OR: [
          { ownerUserId: userId },
          {
            workspace: {
              memberships: {
                some: { userId, role: { in: ['OWNER', 'ADMIN'] } },
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (!troupe) throw new NotFoundException('Troupe not found');
    const participationType =
      String(participationTypeRaw ?? '').trim() || 'PARTNER';
    return this.prisma.theaterTroupe.upsert({
      where: { theaterId_troupeId: { theaterId, troupeId } },
      update: { participationType },
      create: { theaterId, troupeId, participationType },
    });
  }
}
