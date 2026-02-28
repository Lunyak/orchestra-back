import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function normalizeRoleKey(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[_\-.]+/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEmail(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

function looksLikeEmail(v: string): boolean {
  return /.+@.+\..+/.test(v);
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertUserHasProjectAccessBySlug(userId: string, slug: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { members: { some: { userId, role: 'editor' } } },
        ],
      },
      select: { id: true, slug: true, ownerId: true },
    });
    if (!project) throw new ForbiddenException('No access to project');
    return project;
  }

  async listRoles(userId: string, projectSlug: string) {
    const project = await this.assertUserHasProjectAccessBySlug(userId, projectSlug);
    const roles = await this.prisma.projectRole.findMany({
      where: { projectId: project.id },
      orderBy: { title: 'asc' },
      include: {
        aliases: true,
        assignments: true,
      },
    });
    return {
      projectId: project.id,
      roles: roles.map((r) => ({
        id: r.id,
        key: r.key,
        title: r.title,
        description: r.description,
        aliases: (r.aliases ?? []).map((a) => a.title),
        emails: (r.assignments ?? []).map((a) => a.email),
      })),
    };
  }

  async upsertRole(
    userId: string,
    projectSlug: string,
    roleId: string | null,
    body: { title: string; description?: string; aliases?: string[] },
  ) {
    const project = await this.assertUserHasProjectAccessBySlug(userId, projectSlug);
    const title = String(body?.title ?? '').trim();
    if (!title) throw new BadRequestException('title is required');
    const key = normalizeRoleKey(title);
    if (!key) throw new BadRequestException('invalid title');

    const description = body?.description != null ? String(body.description).trim() || null : null;
    const aliases = Array.isArray(body?.aliases)
      ? body.aliases
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .slice(0, 50)
      : [];

    const role = roleId
      ? await this.prisma.projectRole.update({
          where: { id: roleId },
          data: { title, description, key, projectId: project.id },
        })
      : await this.prisma.projectRole.upsert({
          where: { projectId_key: { projectId: project.id, key } },
          update: { title, description },
          create: { projectId: project.id, title, key, description },
        });

    // replace aliases
    await this.prisma.projectRoleAlias.deleteMany({ where: { roleId: role.id } });
    const aliasRows = aliases
      .map((a) => ({ roleId: role.id, title: a, key: normalizeRoleKey(a) }))
      .filter((x) => x.key);
    if (aliasRows.length) {
      await this.prisma.projectRoleAlias.createMany({ data: aliasRows, skipDuplicates: true });
    }

    return { ok: true, roleId: role.id };
  }

  async setRoleAssignments(
    userId: string,
    projectSlug: string,
    roleId: string,
    body: { emails?: string[] },
  ) {
    await this.assertUserHasProjectAccessBySlug(userId, projectSlug);
    const emails = Array.isArray(body?.emails) ? body.emails : [];
    const normalized = emails
      .map((e) => normalizeEmail(e))
      .filter((e) => e && looksLikeEmail(e))
      .slice(0, 200);

    await this.prisma.$transaction(async (tx) => {
      await tx.projectRoleAssignment.deleteMany({ where: { roleId } });
      if (normalized.length) {
        await tx.projectRoleAssignment.createMany({
          data: normalized.map((email) => ({ roleId, email })),
          skipDuplicates: true,
        });
      }
    });

    return { ok: true };
  }

  async listRoleNotes(userId: string, projectSlug: string, roleId: string) {
    const project = await this.assertUserHasProjectAccessBySlug(userId, projectSlug);
    const role = await this.prisma.projectRole.findFirst({
      where: { id: roleId, projectId: project.id },
      select: { id: true, title: true, key: true },
    });
    if (!role) throw new BadRequestException('Role not found');
    const notes = await this.prisma.projectRoleNote.findMany({
      where: { roleId: role.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        authorEmail: true,
        authorUserId: true,
        authorUser: { select: { email: true } },
      },
    });
    return {
      role: { id: role.id, title: role.title, key: role.key },
      notes: notes.map((n) => ({
        id: n.id,
        content: n.content,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        authorEmail: n.authorEmail ?? n.authorUser?.email ?? null,
        authorUserId: n.authorUserId ?? null,
      })),
    };
  }

  async addRoleNote(
    userId: string,
    projectSlug: string,
    roleId: string,
    body: { content: string },
  ) {
    const project = await this.assertUserHasProjectAccessBySlug(userId, projectSlug);
    const role = await this.prisma.projectRole.findFirst({
      where: { id: roleId, projectId: project.id },
      select: { id: true },
    });
    if (!role) throw new BadRequestException('Role not found');
    const content = String(body?.content ?? '').trim();
    if (!content) throw new BadRequestException('content is required');

    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const authorEmail = author?.email ? String(author.email).trim().toLowerCase() : null;

    const created = await this.prisma.projectRoleNote.create({
      data: {
        roleId: role.id,
        authorUserId: userId,
        authorEmail,
        content,
      },
      select: { id: true },
    });
    return { ok: true, noteId: created.id };
  }

  /**
   * One-time seed: if project has no roles yet, create roles+assignments from Step.cast.
   * Safe to call repeatedly.
   */
  async seedFromStepCastIfEmpty(projectId: string) {
    const existingCount = await this.prisma.projectRole.count({ where: { projectId } });
    if (existingCount > 0) return { ok: true, seeded: false };

    const steps = await this.prisma.step.findMany({
      where: { scene: { projectId }, deletedAt: null, cast: { not: null } },
      select: { cast: true },
      take: 5000,
    });

    const roleToEmails = new Map<string, Set<string>>();
    for (const st of steps) {
      const cast = st.cast as any;
      if (!cast || typeof cast !== 'object' || Array.isArray(cast)) continue;
      for (const [roleTitleRaw, value] of Object.entries(cast)) {
        const roleTitle = String(roleTitleRaw ?? '').trim();
        const key = normalizeRoleKey(roleTitle);
        if (!key) continue;
        const list = Array.isArray(value)
          ? value.map((x) => String(x ?? '').trim())
          : typeof value === 'string'
            ? [value.trim()]
            : [];
        const set = roleToEmails.get(key) ?? new Set<string>();
        list
          .map((x) => normalizeEmail(x))
          .filter((x) => x && looksLikeEmail(x))
          .forEach((e) => set.add(e));
        roleToEmails.set(key, set);
      }
    }

    if (roleToEmails.size === 0) return { ok: true, seeded: false };

    await this.prisma.$transaction(async (tx) => {
      for (const [key, emailsSet] of roleToEmails.entries()) {
        const title = key; // better than nothing; UI can rename later
        const role = await tx.projectRole.create({
          data: { projectId, key, title },
          select: { id: true },
        });
        const emails = Array.from(emailsSet).slice(0, 200);
        if (emails.length) {
          await tx.projectRoleAssignment.createMany({
            data: emails.map((email) => ({ roleId: role.id, email })),
            skipDuplicates: true,
          });
        }
      }
    });
    return { ok: true, seeded: true };
  }

  async resolveAssignmentsByRoleKeys(projectId: string, roleKeys: string[]) {
    const keys = (roleKeys ?? [])
      .map((k) => normalizeRoleKey(k))
      .filter(Boolean);
    if (keys.length === 0) return new Map<string, string[]>();

    // Seed if empty (so older projects with Step.cast keep working).
    await this.seedFromStepCastIfEmpty(projectId);

    const roles = await this.prisma.projectRole.findMany({
      where: { projectId, key: { in: Array.from(new Set(keys)) } },
      include: { assignments: true },
    });
    const out = new Map<string, string[]>();
    for (const r of roles) {
      out.set(
        r.key,
        (r.assignments ?? []).map((a) => a.email),
      );
    }
    return out;
  }
}

