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

const TEAM_MEMBER_ROLES = new Set([
  'actor',
  'director',
  'accountant',
  'artist',
  'producer',
  'smm',
  'assistant_director',
  'troupe_manager',
]);

function normalizeTeamRoles(raw: unknown, fallback: string[] = []): string[] {
  const values = Array.isArray(raw) ? raw : fallback;
  const out: string[] = [];
  for (const value of values) {
    const role = String(value ?? '')
      .trim()
      .toLowerCase();
    if (!TEAM_MEMBER_ROLES.has(role)) continue;
    if (!out.includes(role)) out.push(role);
  }
  return out;
}

function mergeTeamRoles(raw: unknown, roles: string[]): string[] {
  return normalizeTeamRoles([...(Array.isArray(raw) ? raw : []), ...roles]);
}

function normalizeTroupeMemberKind(raw: unknown): 'regular' | 'guest' {
  return raw === 'guest' ? 'guest' : 'regular';
}

const DEFAULT_TEAM_ROLE_DEFINITIONS = [
  {
    slug: 'director',
    title: 'Режиссёр',
    parentSlug: null,
    sortOrder: 10,
    description:
      'Отвечает за художественную целостность спектаклей, репетиционный процесс и ключевые творческие решения.',
  },
  {
    slug: 'assistant_director',
    title: 'Помощник режиссёра',
    parentSlug: 'director',
    sortOrder: 20,
    description:
      'Помогает вести репетиции, фиксирует задачи, следит за готовностью сцен и коммуникацией с участниками.',
  },
  {
    slug: 'producer',
    title: 'Продюсер',
    parentSlug: null,
    sortOrder: 30,
    description:
      'Собирает ресурсы проекта, держит сроки, бюджет, партнёров и общую организацию производства.',
  },
  {
    slug: 'accountant',
    title: 'Бухгалтер',
    parentSlug: 'producer',
    sortOrder: 40,
    description:
      'Ведёт финансовые документы, выплаты, отчётность и контроль расходов.',
  },
  {
    slug: 'smm',
    title: 'SMM',
    parentSlug: 'producer',
    sortOrder: 50,
    description:
      'Отвечает за соцсети, публикации, афиши, анонсы и коммуникацию с аудиторией.',
  },
  {
    slug: 'artist',
    title: 'Художник',
    parentSlug: null,
    sortOrder: 60,
    description:
      'Отвечает за визуальное решение, материалы, реквизит, костюмы или сценографию.',
  },
  {
    slug: 'troupe_manager',
    title: 'Заведующий труппой',
    parentSlug: null,
    sortOrder: 70,
    description:
      'Ведёт состав труппы, занятость, коммуникацию с актёрами и организационные вопросы.',
  },
] as const;

function slugifyRoleTitle(raw: unknown): string {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `role-${Date.now()}`;
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

  private async ensureTeamMemberWithRoles(
    ownerUserId: string,
    email: string,
    roles: string[],
    memberUserId?: string | null,
  ) {
    const normalizedRoles = normalizeTeamRoles(roles);
    const existing = await this.prisma.teamMember.findUnique({
      where: { ownerUserId_email: { ownerUserId, email } },
      select: { id: true, roles: true, userId: true },
    });
    if (existing) {
      return this.prisma.teamMember.update({
        where: { id: existing.id },
        data: {
          roles: mergeTeamRoles(existing.roles, normalizedRoles),
          userId: existing.userId ?? memberUserId ?? null,
        },
      });
    }
    return this.prisma.teamMember.create({
      data: {
        ownerUserId,
        email,
        userId: memberUserId ?? null,
        roles: normalizedRoles,
      },
    });
  }

  private async formatTeamMember(row: {
    id: string;
    ownerUserId: string;
    userId: string | null;
    email: string;
    roles: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const email = row.email.trim().toLowerCase();
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
    const troupe = await this.prisma.troupe.findUnique({
      where: { ownerUserId: row.ownerUserId },
      select: { id: true },
    });
    const troupeMember = troupe
      ? await this.prisma.troupeMember.findUnique({
          where: { troupeId_email: { troupeId: troupe.id, email } },
          select: { id: true },
        })
      : null;
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      userId: row.userId,
      email,
      roles: normalizeTeamRoles(row.roles),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      profile: profile ?? null,
      troupeMemberId: troupeMember?.id ?? null,
    };
  }

  private async ensureDefaultTeamRoles(troupeId: string) {
    const existingCount = await this.prisma.teamRoleDefinition.count({
      where: { troupeId },
    });
    if (existingCount > 0) return;

    const roleBySlug = new Map<string, { id: string }>();
    for (const role of DEFAULT_TEAM_ROLE_DEFINITIONS) {
      const row = await this.prisma.teamRoleDefinition.upsert({
        where: { troupeId_slug: { troupeId, slug: role.slug } },
        create: {
          troupeId,
          slug: role.slug,
          title: role.title,
          sortOrder: role.sortOrder,
          description: role.description,
        },
        update: {},
        select: { id: true, slug: true },
      });
      roleBySlug.set(row.slug, row);
    }

    for (const role of DEFAULT_TEAM_ROLE_DEFINITIONS) {
      if (!role.parentSlug) continue;
      const row = roleBySlug.get(role.slug);
      const parent = roleBySlug.get(role.parentSlug);
      if (!row || !parent) continue;
      await this.prisma.teamRoleDefinition.update({
        where: { id: row.id },
        data: { parentId: parent.id },
      });
    }
  }

  private async buildProfileMap(emails: string[]) {
    const uniqueEmails = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
    if (uniqueEmails.length === 0) return new Map<string, any>();
    const profiles = await this.prisma.userProfile.findMany({
      where: { email: { in: uniqueEmails } },
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
    return new Map(profiles.map((profile) => [profile.email.trim().toLowerCase(), profile]));
  }

  private formatTeamRoleAssignment(
    assignment: {
      id: string;
      createdAt: Date;
      teamMember: {
        id: string;
        email: string;
        userId: string | null;
        ownerUserId: string;
        roles: unknown;
        createdAt: Date;
        updatedAt: Date;
      };
    },
    profileByEmail: Map<string, any>,
  ) {
    const email = assignment.teamMember.email.trim().toLowerCase();
    return {
      id: assignment.id,
      createdAt: assignment.createdAt.toISOString(),
      teamMember: {
        id: assignment.teamMember.id,
        ownerUserId: assignment.teamMember.ownerUserId,
        userId: assignment.teamMember.userId,
        email,
        roles: normalizeTeamRoles(assignment.teamMember.roles),
        createdAt: assignment.teamMember.createdAt.toISOString(),
        updatedAt: assignment.teamMember.updatedAt.toISOString(),
        profile: profileByEmail.get(email) ?? null,
      },
    };
  }

  private async formatTeamRoles(
    roles: Array<{
      id: string;
      troupeId: string;
      slug: string;
      title: string;
      parentId: string | null;
      sortOrder: number;
      description: string;
      createdAt: Date;
      updatedAt: Date;
      assignments: Array<{
        id: string;
        createdAt: Date;
        teamMember: {
          id: string;
          email: string;
          userId: string | null;
          ownerUserId: string;
          roles: unknown;
          createdAt: Date;
          updatedAt: Date;
        };
      }>;
    }>,
  ) {
    const profileByEmail = await this.buildProfileMap(
      roles.flatMap((role) =>
        role.assignments.map((assignment) => assignment.teamMember.email),
      ),
    );
    return roles.map((role) => {
      const assignments = role.assignments.map((assignment) =>
        this.formatTeamRoleAssignment(assignment, profileByEmail),
      );
      return {
        id: role.id,
        troupeId: role.troupeId,
        slug: role.slug,
        title: role.title,
        parentId: role.parentId,
        sortOrder: role.sortOrder,
        description: role.description,
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
        assignmentCount: assignments.length,
        assignments,
        assignees: assignments.map((assignment) => assignment.teamMember),
      };
    });
  }

  private teamRoleInclude() {
    return {
      assignments: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          createdAt: true,
          teamMember: {
            select: {
              id: true,
              email: true,
              userId: true,
              ownerUserId: true,
              roles: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    };
  }

  async getTeamRoles(userId: string) {
    const troupe = await this.getOrCreateMyTroupe(userId);
    await this.ensureDefaultTeamRoles(troupe.id);
    const roles = await this.prisma.teamRoleDefinition.findMany({
      where: { troupeId: troupe.id },
      include: this.teamRoleInclude(),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return this.formatTeamRoles(roles);
  }

  async getTeamRole(userId: string, roleId: string) {
    const troupe = await this.getOrCreateMyTroupe(userId);
    await this.ensureDefaultTeamRoles(troupe.id);
    const role = await this.prisma.teamRoleDefinition.findFirst({
      where: { id: String(roleId ?? '').trim(), troupeId: troupe.id },
      include: this.teamRoleInclude(),
    });
    if (!role) throw new NotFoundException('Team role not found');
    const [formatted] = await this.formatTeamRoles([role]);
    return formatted;
  }

  async createTeamRole(userId: string, body: unknown) {
    const troupe = await this.getOrCreateMyTroupe(userId);
    await this.ensureDefaultTeamRoles(troupe.id);
    const dto = (body ?? {}) as {
      title?: unknown;
      parentId?: unknown;
      sortOrder?: unknown;
      description?: unknown;
    };
    const title = String(dto.title ?? '').trim().replace(/\s+/g, ' ');
    if (!title) throw new BadRequestException('title is required');
    const parentId =
      typeof dto.parentId === 'string' && dto.parentId.trim()
        ? dto.parentId.trim()
        : null;
    if (parentId) {
      const parent = await this.prisma.teamRoleDefinition.findFirst({
        where: { id: parentId, troupeId: troupe.id },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException('Parent role not found');
    }
    const baseSlug = slugifyRoleTitle(title);
    let slug = baseSlug;
    let i = 2;
    while (
      await this.prisma.teamRoleDefinition.findUnique({
        where: { troupeId_slug: { troupeId: troupe.id, slug } },
        select: { id: true },
      })
    ) {
      slug = `${baseSlug}-${i}`;
      i += 1;
    }
    const role = await this.prisma.teamRoleDefinition.create({
      data: {
        troupeId: troupe.id,
        slug,
        title,
        parentId,
        sortOrder:
          typeof dto.sortOrder === 'number' && Number.isFinite(dto.sortOrder)
            ? dto.sortOrder
            : 100,
        description: String(dto.description ?? '').trim(),
      },
      include: this.teamRoleInclude(),
    });
    const [formatted] = await this.formatTeamRoles([role]);
    return formatted;
  }

  async updateTeamRole(userId: string, roleId: string, body: unknown) {
    const troupe = await this.getOrCreateMyTroupe(userId);
    const id = String(roleId ?? '').trim();
    if (!id) throw new BadRequestException('roleId is required');
    const existing = await this.prisma.teamRoleDefinition.findFirst({
      where: { id, troupeId: troupe.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Team role not found');
    const dto = (body ?? {}) as {
      title?: unknown;
      parentId?: unknown;
      sortOrder?: unknown;
      description?: unknown;
    };
    const nextParentId =
      typeof dto.parentId === 'string'
        ? dto.parentId.trim() || null
        : dto.parentId === null
          ? null
          : undefined;
    if (nextParentId) {
      if (nextParentId === id) {
        throw new BadRequestException('Role cannot be parent of itself');
      }
      const parent = await this.prisma.teamRoleDefinition.findFirst({
        where: { id: nextParentId, troupeId: troupe.id },
        select: { id: true, parentId: true },
      });
      if (!parent) throw new NotFoundException('Parent role not found');

      let cursorParentId = parent.parentId;
      while (cursorParentId) {
        if (cursorParentId === id) {
          throw new BadRequestException('Role cannot be moved under its child');
        }
        const ancestor = await this.prisma.teamRoleDefinition.findFirst({
          where: { id: cursorParentId, troupeId: troupe.id },
          select: { parentId: true },
        });
        cursorParentId = ancestor?.parentId ?? null;
      }
    }
    const data: Prisma.TeamRoleDefinitionUpdateInput = {};
    if (typeof dto.title === 'string') {
      const title = dto.title.trim().replace(/\s+/g, ' ');
      if (!title) throw new BadRequestException('title is required');
      data.title = title;
    }
    if (nextParentId !== undefined) {
      data.parent = nextParentId
        ? { connect: { id: nextParentId } }
        : { disconnect: true };
    }
    if (typeof dto.sortOrder === 'number' && Number.isFinite(dto.sortOrder)) {
      data.sortOrder = dto.sortOrder;
    }
    if (typeof dto.description === 'string') {
      data.description = dto.description.trim();
    }
    const role = await this.prisma.teamRoleDefinition.update({
      where: { id },
      data,
      include: this.teamRoleInclude(),
    });
    const [formatted] = await this.formatTeamRoles([role]);
    return formatted;
  }

  async removeTeamRole(userId: string, roleId: string) {
    const troupe = await this.getOrCreateMyTroupe(userId);
    const id = String(roleId ?? '').trim();
    if (!id) throw new BadRequestException('roleId is required');
    const res = await this.prisma.teamRoleDefinition.deleteMany({
      where: { id, troupeId: troupe.id },
    });
    if (res.count === 0) throw new NotFoundException('Team role not found');
    return { ok: true };
  }

  async addTeamRoleAssignment(
    userId: string,
    roleId: string,
    rawEmail: unknown,
  ) {
    const troupe = await this.getOrCreateMyTroupe(userId);
    const id = String(roleId ?? '').trim();
    if (!id) throw new BadRequestException('roleId is required');
    const role = await this.prisma.teamRoleDefinition.findFirst({
      where: { id, troupeId: troupe.id },
      select: { id: true, slug: true },
    });
    if (!role) throw new NotFoundException('Team role not found');
    const email = normalizeEmail(rawEmail);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    const teamMember = await this.ensureTeamMemberWithRoles(
      userId,
      email,
      [role.slug],
      user?.id ?? null,
    );
    try {
      await this.prisma.teamRoleAssignment.create({
        data: {
          roleId: role.id,
          teamMemberId: teamMember.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Этот человек уже назначен на должность');
      }
      throw error;
    }
    return this.getTeamRole(userId, role.id);
  }

  async removeTeamRoleAssignment(
    userId: string,
    roleId: string,
    assignmentId: string,
  ) {
    const troupe = await this.getOrCreateMyTroupe(userId);
    const role = await this.prisma.teamRoleDefinition.findFirst({
      where: { id: String(roleId ?? '').trim(), troupeId: troupe.id },
      select: { id: true },
    });
    if (!role) throw new NotFoundException('Team role not found');
    const res = await this.prisma.teamRoleAssignment.deleteMany({
      where: { id: String(assignmentId ?? '').trim(), roleId: role.id },
    });
    if (res.count === 0) throw new NotFoundException('Assignment not found');
    return { ok: true };
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
            role: true,
            user: { select: { email: true } },
          },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found or access denied');
    }

    const ownTroupe = await this.prisma.troupe.findUnique({
      where: { ownerUserId: userId },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });

    const ownerEmail = project.owner?.email?.trim().toLowerCase() ?? '';

    const troupeMemberIdByEmail = new Map<string, string>();
    const troupeRows = ownTroupe
      ? await this.prisma.troupeMember.findMany({
          where: { troupeId: ownTroupe.id },
          select: {
            id: true,
            troupeId: true,
            userId: true,
            email: true,
            kind: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    for (const tm of troupeRows) {
      const e = tm.email.trim().toLowerCase();
      if (!e) continue;
      troupeMemberIdByEmail.set(e, tm.id);
      await this.ensureTeamMemberWithRoles(userId, e, ['actor'], tm.userId);
    }
    const troupeMemberKindByEmail = new Map(
      troupeRows.map((tm) => [
        tm.email.trim().toLowerCase(),
        normalizeTroupeMemberKind(tm.kind),
      ]),
    );

    const teamRows = await this.prisma.teamMember.findMany({
      where: { ownerUserId: userId },
      select: {
        id: true,
        ownerUserId: true,
        userId: true,
        email: true,
        roles: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const projectCastEmails: string[] = [];
    if (ownerEmail) projectCastEmails.push(ownerEmail);
    for (const m of project.members) {
      const e = m.user.email?.trim().toLowerCase();
      if (e && e !== ownerEmail) projectCastEmails.push(e);
    }

    const emailSet = new Set<string>([
      ...teamRows.map((tm) => tm.email.trim().toLowerCase()).filter(Boolean),
      ...troupeRows.map((tm) => tm.email.trim().toLowerCase()).filter(Boolean),
      ...projectCastEmails,
    ]);
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

    const buildProfile = (email: string) => {
      const raw = profileByEmail.get(email) ?? null;
      return raw && monthRange
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
    };

    const troupeMembers = troupeRows.map((tm) => {
      const email = tm.email.trim().toLowerCase();
      const profile = buildProfile(email);
      return {
        id: tm.id,
        troupeId: tm.troupeId,
        email,
        kind: normalizeTroupeMemberKind(tm.kind),
        createdAt: tm.createdAt.toISOString(),
        profile,
        troupeMemberId: tm.id,
      };
    });
    const teamMemberIdByEmail = new Map(
      teamRows.map((tm) => [tm.email.trim().toLowerCase(), tm.id]),
    );
    const teamMembers = teamRows.map((tm) => {
      const email = tm.email.trim().toLowerCase();
      const profile = buildProfile(email);
      return {
        id: tm.id,
        ownerUserId: tm.ownerUserId,
        userId: tm.userId,
        email,
        roles: normalizeTeamRoles(tm.roles),
        createdAt: tm.createdAt.toISOString(),
        updatedAt: tm.updatedAt.toISOString(),
        profile,
        troupeMemberId: troupeMemberIdByEmail.get(email) ?? null,
      };
    });

    const projectCastMembers = projectCastEmails.map((email) => {
      const projectMember = project.members.find(
        (m) => m.user.email?.trim().toLowerCase() === email,
      );
      const troupeMemberId = troupeMemberIdByEmail.get(email) ?? null;
      const stableId = projectMember?.id ?? `powner:${project.id}:${email}`;
      const profile = buildProfile(email);
      return {
        id: stableId,
        troupeId: ownTroupe?.id ?? project.id,
        email,
        kind: troupeMemberKindByEmail.get(email) ?? 'regular',
        createdAt: project.createdAt.toISOString(),
        profile,
        troupeMemberId,
        projectMemberId: projectMember?.id ?? null,
        projectRole: projectMember?.role ?? 'owner',
        isProjectOwner: email === ownerEmail,
        inTroupe: Boolean(troupeMemberId),
        teamMemberId: teamMemberIdByEmail.get(email) ?? null,
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
      members: troupeMembers,
      troupeMembers,
      teamMembers,
      projectCastMembers,
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
          kind: true,
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
      await this.ensureTeamMemberWithRoles(userId, email, ['actor'], user?.id ?? null);

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

  async updateTroupeMemberKind(
    userId: string,
    memberId: string,
    rawKind: unknown,
    projectSlug?: unknown,
  ) {
    await this.assertUserOwnsProject(userId, projectSlug);
    const id = String(memberId ?? '').trim();
    if (!id) throw new BadRequestException('memberId is required');
    const kind = normalizeTroupeMemberKind(rawKind);
    const troupe = await this.getOrCreateMyTroupe(userId);
    const res = await this.prisma.troupeMember.updateMany({
      where: { id, troupeId: troupe.id },
      data: { kind },
    });
    if (res.count === 0) throw new NotFoundException('Troupe member not found');
    const updated = await this.prisma.troupeMember.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        troupeId: true,
        userId: true,
        email: true,
        kind: true,
        createdAt: true,
      },
    });
    const profile = await this.prisma.userProfile.findUnique({
      where: { email: updated.email },
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
    return {
      id: updated.id,
      troupeId: updated.troupeId,
      email: updated.email,
      kind: normalizeTroupeMemberKind(updated.kind),
      createdAt: updated.createdAt.toISOString(),
      profile: profile ?? null,
      troupeMemberId: updated.id,
    };
  }

  async addTeamMember(userId: string, rawEmail: unknown, rawRoles: unknown) {
    const email = normalizeEmail(rawEmail);
    const roles = normalizeTeamRoles(rawRoles);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    try {
      const row = await this.prisma.teamMember.create({
        data: {
          ownerUserId: userId,
          email,
          userId: user?.id ?? null,
          roles,
        },
      });
      return this.formatTeamMember(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Участник с таким email уже есть в команде');
      }
      throw error;
    }
  }

  async updateTeamMember(userId: string, memberId: string, rawRoles: unknown) {
    const id = String(memberId ?? '').trim();
    if (!id) throw new BadRequestException('memberId is required');
    const existing = await this.prisma.teamMember.findFirst({
      where: { id, ownerUserId: userId },
      select: { email: true },
    });
    if (!existing) throw new NotFoundException('Team member not found');
    const troupe = await this.prisma.troupe.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    const troupeMember = troupe
      ? await this.prisma.troupeMember.findUnique({
          where: {
            troupeId_email: {
              troupeId: troupe.id,
              email: existing.email.trim().toLowerCase(),
            },
          },
          select: { id: true },
        })
      : null;
    const roles = troupeMember
      ? mergeTeamRoles(rawRoles, ['actor'])
      : normalizeTeamRoles(rawRoles);
    const res = await this.prisma.teamMember.updateMany({
      where: { id, ownerUserId: userId },
      data: { roles },
    });
    if (res.count === 0) throw new NotFoundException('Team member not found');
    const row = await this.prisma.teamMember.findUniqueOrThrow({
      where: { id },
    });
    return this.formatTeamMember(row);
  }

  async removeTeamMember(userId: string, memberId: string) {
    const id = String(memberId ?? '').trim();
    if (!id) throw new BadRequestException('memberId is required');
    const existing = await this.prisma.teamMember.findFirst({
      where: { id, ownerUserId: userId },
      select: { email: true },
    });
    if (!existing) throw new NotFoundException('Team member not found');
    const troupe = await this.prisma.troupe.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    const troupeMember = troupe
      ? await this.prisma.troupeMember.findUnique({
          where: {
            troupeId_email: {
              troupeId: troupe.id,
              email: existing.email.trim().toLowerCase(),
            },
          },
          select: { id: true },
        })
      : null;
    if (troupeMember) {
      throw new ConflictException(
        'Сначала удалите участника из состава труппы',
      );
    }
    const res = await this.prisma.teamMember.deleteMany({
      where: { id, ownerUserId: userId },
    });
    if (res.count === 0) throw new NotFoundException('Team member not found');
    return { ok: true };
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
