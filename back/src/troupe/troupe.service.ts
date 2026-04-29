import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function normalizeEmail(v: unknown): string {
  const email = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!email) throw new BadRequestException('email is required');
  return email;
}

function parseMonthFilter(v: unknown): { first: string; last: string } | null {
  const s = String(v ?? '').trim();
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12 || !Number.isFinite(y)) return null;
  const ym = `${m[1]}-${m[2]}`;
  const first = `${ym}-01`;
  const lastDay = new Date(y, mo, 0).getDate();
  const last = `${ym}-${String(lastDay).padStart(2, '0')}`;
  return { first, last };
}

function filterAvailabilityByMonth<T extends Record<string, unknown>>(
  raw: unknown,
  first: string,
  last: string,
): T {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {} as T;
  }
  const out = {} as T;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k >= first && k <= last) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

@Injectable()
export class TroupeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Добавление/удаление в труппу с экрана «по проекту» — только владелец этого проекта. */
  private async assertUserOwnsProject(userId: string, projectSlugRaw: unknown) {
    const slug =
      typeof projectSlugRaw === 'string' ? projectSlugRaw.trim() : '';
    if (!slug) {
      throw new BadRequestException('query "project" (slug) is required');
    }
    const project = await this.prisma.project.findFirst({
      where: { slug, deletedAt: null, ownerId: userId },
      select: { id: true },
    });
    if (!project) {
      throw new ForbiddenException(
        'Только владелец проекта может добавлять или удалять участников труппы',
      );
    }
  }

  private async getOrCreateMyTroupe(userId: string) {
    const existing = await this.prisma.troupe.findUnique({
      where: { ownerUserId: userId },
    });
    if (existing) return existing;
    return await this.prisma.troupe.create({
      data: { ownerUserId: userId, title: 'Моя труппа' },
    });
  }

  async getMyTroupeWithMembers(
    userId: string,
    month?: unknown,
    projectSlugRaw?: unknown,
  ) {
    const projectSlug =
      typeof projectSlugRaw === 'string' ? projectSlugRaw.trim() : '';
    if (!projectSlug) {
      throw new BadRequestException('query "project" (slug) is required');
    }

    const project = await this.prisma.project.findFirst({
      where: {
        slug: projectSlug,
        deletedAt: null,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: {
        id: true,
        slug: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        ownerId: true,
        owner: { select: { id: true, email: true } },
        members: {
          select: {
            id: true,
            user: { select: { email: true } },
          },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found or access denied');
    }

    const emailSet = new Set<string>();
    const ownerEmail = project.owner?.email?.trim().toLowerCase() ?? '';
    if (ownerEmail) emailSet.add(ownerEmail);
    for (const m of project.members) {
      const e = m.user.email?.trim().toLowerCase();
      if (e) emailSet.add(e);
    }
    const emails = [...emailSet];

    const profiles = emails.length
      ? await this.prisma.userProfile.findMany({
          where: { email: { in: emails } },
          select: {
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
            telegramId: true,
            avatarUrl: true,
            availabilityCalendar: true,
            availabilityTimeRanges: true,
          },
        })
      : [];

    const profileByEmail = new Map(
      profiles.map((p) => [p.email.trim().toLowerCase(), p]),
    );
    const monthRange = parseMonthFilter(month);

    const ownTroupe = await this.prisma.troupe.findUnique({
      where: { ownerUserId: userId },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });

    const isDirectorOfThisProject = project.ownerId === userId;
    const troupeMemberIdByEmail = new Map<string, string>();
    if (isDirectorOfThisProject && ownTroupe) {
      const troupeMembers = await this.prisma.troupeMember.findMany({
        where: { troupeId: ownTroupe.id, email: { in: emails } },
        select: { id: true, email: true },
      });
      for (const tm of troupeMembers) {
        troupeMemberIdByEmail.set(
          tm.email.trim().toLowerCase(),
          tm.id,
        );
      }
    }

    const orderedEmails: string[] = [];
    if (ownerEmail) orderedEmails.push(ownerEmail);
    for (const m of project.members) {
      const e = m.user.email?.trim().toLowerCase();
      if (e && e !== ownerEmail) orderedEmails.push(e);
    }

    const scheduleMembers = orderedEmails.map((email) => {
      const raw = profileByEmail.get(email) ?? null;
      const profile =
        raw && monthRange
          ? {
              ...raw,
              availabilityCalendar: filterAvailabilityByMonth(
                raw.availabilityCalendar,
                monthRange.first,
                monthRange.last,
              ),
              availabilityTimeRanges: filterAvailabilityByMonth(
                raw.availabilityTimeRanges,
                monthRange.first,
                monthRange.last,
              ),
            }
          : raw;
      const troupeMemberId = troupeMemberIdByEmail.get(email) ?? null;
      const stableId = troupeMemberId ?? `pteam:${project.id}:${email}`;
      return {
        id: stableId,
        troupeId: ownTroupe?.id ?? project.id,
        email,
        createdAt: project.createdAt.toISOString(),
        profile,
        troupeMemberId,
      };
    });

    return {
      troupe: ownTroupe
        ? {
            id: ownTroupe.id,
            title: ownTroupe.title,
            createdAt: ownTroupe.createdAt,
            updatedAt: ownTroupe.updatedAt,
          }
        : null,
      members: scheduleMembers,
    };
  }

  async addMember(userId: string, rawEmail: unknown, projectSlug?: unknown) {
    await this.assertUserOwnsProject(userId, projectSlug);
    const troupe = await this.getOrCreateMyTroupe(userId);
    const email = normalizeEmail(rawEmail);

    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      const created = await this.prisma.troupeMember.create({
        data: { troupeId: troupe.id, email, userId: user?.id ?? null },
        select: {
          id: true,
          troupeId: true,
          userId: true,
          email: true,
          createdAt: true,
        },
      });

      const profile = await this.prisma.userProfile.findUnique({
        where: { email },
        select: {
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
          telegramId: true,
          avatarUrl: true,
          availabilityCalendar: true,
          availabilityTimeRanges: true,
        },
      });

      return { ...created, profile: profile ?? null };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Участник с таким email уже есть в труппе');
      }
      throw error;
    }
  }

  async updateMyTroupeTitle(userId: string, rawTitle: unknown) {
    const title = String(rawTitle ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!title) throw new BadRequestException('title is required');
    if (title.length > 120) throw new BadRequestException('title is too long');

    const troupe = await this.prisma.troupe.findUnique({
      where: { ownerUserId: userId },
    });
    if (!troupe) {
      throw new NotFoundException(
        'Своей труппы ещё нет — добавьте первого участника по email',
      );
    }
    const updated = await this.prisma.troupe.update({
      where: { id: troupe.id },
      data: { title },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return updated;
  }

  async removeMember(userId: string, memberId: string, projectSlug?: unknown) {
    await this.assertUserOwnsProject(userId, projectSlug);
    const troupe = await this.prisma.troupe.findUnique({
      where: { ownerUserId: userId },
    });
    if (!troupe) throw new NotFoundException('Troupe not found');
    const id = String(memberId ?? '').trim();
    if (!id) throw new BadRequestException('memberId is required');

    const res = await this.prisma.troupeMember.deleteMany({
      where: { id, troupeId: troupe.id },
    });
    if (res.count === 0) throw new NotFoundException('Member not found');
    return { ok: true };
  }
}
