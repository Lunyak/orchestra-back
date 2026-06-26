import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

function extractRolesFromText(text?: string | null): string[] {
  const s = String(text ?? '');
  if (!s.trim()) return [];
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const role = String(m[1] ?? '').trim();
    if (role) out.push(role);
  }
  const lines = s.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('==') || line.startsWith('(')) continue;
    const m1 = line.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.-]{1,40})\s*[:—-]\s+\S/);
    if (m1?.[1]) {
      out.push(m1[1].replace(/\s+/g, ' ').trim());
      continue;
    }
    const m2 = line.match(/^([A-ZА-ЯЁ]{2,40})([.,!?:])\s+/);
    if (m2?.[1]) out.push(m2[1].trim());
  }
  return Array.from(
    new Set(out.map((x) => String(x ?? '').trim()).filter(Boolean)),
  );
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
    const project = await this.assertUserHasProjectAccessBySlug(
      userId,
      projectSlug,
    );
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
        avatarKey: r.avatarKey ?? null,
        aliases: (r.aliases ?? []).map((a) => a.title),
        emails: (r.assignments ?? []).map((a) => a.email),
      })),
    };
  }

  async upsertRole(
    userId: string,
    projectSlug: string,
    roleId: string | null,
    body: {
      title?: string;
      description?: string;
      aliases?: string[];
      avatarKey?: string | null;
    },
  ) {
    const project = await this.assertUserHasProjectAccessBySlug(
      userId,
      projectSlug,
    );

    const existing = roleId
      ? await this.prisma.projectRole.findFirst({
          where: { id: roleId, projectId: project.id },
        })
      : null;
    if (roleId && !existing) throw new BadRequestException('Role not found');

    const titleInput = String(body?.title ?? '').trim();
    const title = titleInput || String(existing?.title ?? '').trim();
    if (!title) throw new BadRequestException('title is required');
    const key = normalizeRoleKey(title);
    if (!key) throw new BadRequestException('invalid title');

    const description =
      body?.description != null
        ? String(body.description).trim() || null
        : undefined;

    const avatarKey =
      body?.avatarKey === null
        ? null
        : body?.avatarKey != null
          ? String(body.avatarKey).trim() || null
          : undefined;

    const aliases = Array.isArray(body?.aliases)
      ? body.aliases
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .slice(0, 50)
      : null;

    const data: Prisma.ProjectRoleUpdateInput = { title, key };
    if (description !== undefined) data.description = description;
    if (avatarKey !== undefined) data.avatarKey = avatarKey;

    const role = roleId
      ? await this.prisma.projectRole.update({
          where: { id: roleId },
          data,
        })
      : await this.prisma.projectRole.upsert({
          where: { projectId_key: { projectId: project.id, key } },
          update: {
            title,
            ...(description !== undefined ? { description } : {}),
            ...(avatarKey !== undefined ? { avatarKey } : {}),
          },
          create: {
            projectId: project.id,
            title,
            key,
            description: description ?? null,
            avatarKey: avatarKey ?? null,
          },
        });

    // replace aliases when provided
    if (aliases != null) {
      await this.prisma.projectRoleAlias.deleteMany({
        where: { roleId: role.id },
      });
      const aliasRows = aliases
        .map((a) => ({ roleId: role.id, title: a, key: normalizeRoleKey(a) }))
        .filter((x) => x.key);
      if (aliasRows.length) {
        await this.prisma.projectRoleAlias.createMany({
          data: aliasRows,
          skipDuplicates: true,
        });
      }
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

  async deleteRole(userId: string, projectSlug: string, roleId: string) {
    const project = await this.assertUserHasProjectAccessBySlug(
      userId,
      projectSlug,
    );
    const rid = String(roleId ?? '').trim();
    if (!rid) throw new BadRequestException('roleId is required');
    const res = await this.prisma.projectRole.deleteMany({
      where: { id: rid, projectId: project.id },
    });
    return { ok: true, deleted: res.count };
  }

  async listRoleNotes(userId: string, projectSlug: string, roleId: string) {
    const project = await this.assertUserHasProjectAccessBySlug(
      userId,
      projectSlug,
    );
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
    const project = await this.assertUserHasProjectAccessBySlug(
      userId,
      projectSlug,
    );
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
    const authorEmail = author?.email
      ? String(author.email).trim().toLowerCase()
      : null;

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
   * One-time seed: if project has no roles yet, create roles from Scene text.
   * Safe to call repeatedly.
   */
  async seedFromSceneCastIfEmpty(projectId: string) {
    const existingCount = await this.prisma.projectRole.count({
      where: { projectId },
    });
    if (existingCount > 0) return { ok: true, seeded: false };

    const scenes = await this.prisma.scene.findMany({
      where: { playbook: { projectId }, deletedAt: null },
      select: { markdown: true, playMarkdown: true },
      take: 5000,
    });

    const keyToTitle = new Map<string, string>();
    for (const st of scenes) {
      const text = (st as any)?.playMarkdown ?? (st as any)?.markdown ?? '';
      for (const roleTitleRaw of extractRolesFromText(text)) {
        const roleTitle = String(roleTitleRaw ?? '').trim();
        const key = normalizeRoleKey(roleTitle);
        if (!key) continue;
        if (!keyToTitle.has(key)) keyToTitle.set(key, roleTitle);
      }
    }

    if (keyToTitle.size === 0) return { ok: true, seeded: false };

    await this.prisma.$transaction(async (tx) => {
      for (const [key, titleRaw] of keyToTitle.entries()) {
        const title = String(titleRaw ?? '').trim() || key;
        await tx.projectRole.create({
          data: { projectId, key, title },
        });
      }
    });
    return { ok: true, seeded: true };
  }

  async resolveAssignmentsByRoleKeys(projectId: string, roleKeys: string[]) {
    const keys = (roleKeys ?? [])
      .map((k) => normalizeRoleKey(k))
      .filter(Boolean);
    if (keys.length === 0) return new Map<string, string[]>();

    // Seed if empty (для проектов без заведённых ролей).
    await this.seedFromSceneCastIfEmpty(projectId);

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
