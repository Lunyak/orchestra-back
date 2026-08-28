import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RehearsalPlanRequestDto } from './dto/rehearsal-plan.dto';
import { BotProfilesUpsertDto } from './dto/bot-profiles.dto';
import {
  collectMonthAvailabilityGaps,
  callNotifyApiFields,
  isScheduledCallDue,
  moscowDateKey,
  parseCallNotifySettings,
  shiftDateKey,
} from '../telegram-bots/call-notify';

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function normalizeRole(role: string): string {
  return String(role ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function extractRolesByBrackets(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const role = (m[1] ?? '').trim();
    if (!role) continue;
    out.push(role);
  }
  return uniq(out);
}

function extractSpeakerRolesFromLines(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Часто встречающиеся режиссёрские пометки
    if (line.startsWith('==') || line.startsWith('(')) continue;

    // "ЛЕОН: ..." / "ЛЕОН — ..." / "ЛЕОН - ..."
    const m1 = line.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.-]{1,40})\s*[:—-]\s+\S/);
    if (m1?.[1]) {
      const role = m1[1].replace(/\s+/g, ' ').trim();
      if (role.length >= 2 && role.length <= 40) out.push(role);
      continue;
    }

    // "ЛЕОН." / "ЛЕОН," в начале строки
    const m2 = line.match(/^([A-ZА-ЯЁ]{2,40})([.,!?:])\s+/);
    if (m2?.[1]) {
      out.push(m2[1].trim());
      continue;
    }
  }
  return uniq(out);
}

function extractRolesSmart(text?: string): string[] {
  const a = extractRolesByBrackets(text);
  const b = extractSpeakerRolesFromLines(text);
  return uniq([...a, ...b]);
}

@Injectable()
export class BotService {
  constructor(private readonly prisma: PrismaService) {}

  async getIntegration(botIntegrationId: string) {
    const id = String(botIntegrationId ?? '').trim();
    if (!id) {
      throw new BadRequestException('botIntegrationId is required');
    }

    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT
        "id",
        "botUsername",
        "botTelegramUserId",
        "title",
        "status",
        "ownerTelegramId",
        "adminTelegramId",
        "groupChatId",
        "attendanceThreadId",
        "announcementsThreadId",
        "defaultProjectSlug",
        "quizGroupChatId",
        "quizThreadId",
        "callNotifyMode",
        "callNotifyAdvanceDays",
        "callNotifyHour",
        "availabilityRemindEnabled",
        "ownerUserId",
        "createdAt",
        "updatedAt"
      FROM "TelegramBotIntegration"
      WHERE "id" = $1
      LIMIT 1`,
      id,
    )) as Array<Record<string, any>>;

    if (rows.length === 0) {
      throw new NotFoundException('Bot integration not found');
    }

    const vars = (await this.prisma.$queryRawUnsafe(
      `SELECT "key","value","isSecret","updatedAt"
       FROM "BotVariable"
       WHERE "botId" = $1
       ORDER BY "key" ASC`,
      id,
    )) as Array<{
      key: string;
      value: string;
      isSecret: boolean;
      updatedAt: Date;
    }>;

    return {
      integration: {
        ...rows[0],
        ...callNotifyApiFields(rows[0]),
      } as Record<string, any>,
      variables: vars,
    };
  }

  async upsertProfiles(dto: BotProfilesUpsertDto) {
    const profiles = Array.isArray(dto.profiles) ? dto.profiles : [];
    if (profiles.length === 0) {
      throw new BadRequestException('profiles is required');
    }

    const results: Array<{ email: string; ok: boolean }> = [];
    for (const p of profiles) {
      const email = p.email.trim().toLowerCase();
      await this.prisma.userProfile.upsert({
        where: { email },
        update: {
          displayName: p.displayName?.trim() || null,
          firstName: p.firstName?.trim() || null,
          lastName: p.lastName?.trim() || null,
          telegramUsername: p.telegramUsername?.trim() || null,
          telegramId: p.telegramId?.trim() || null,
        },
        create: {
          email,
          displayName: p.displayName?.trim() || null,
          firstName: p.firstName?.trim() || null,
          lastName: p.lastName?.trim() || null,
          telegramUsername: p.telegramUsername?.trim() || null,
          telegramId: p.telegramId?.trim() || null,
        },
      });
      results.push({ email, ok: true });
    }

    return { ok: true, results };
  }

  async resolveProfiles(emails: string[]) {
    const normalized = Array.from(
      new Set(
        (emails ?? [])
          .map((e) =>
            String(e ?? '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );
    if (normalized.length === 0) {
      throw new BadRequestException('emails is required');
    }
    const profiles = await this.prisma.userProfile.findMany({
      where: { email: { in: normalized } },
      select: {
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        telegramUsername: true,
        telegramId: true,
        avatarUrl: true,
      },
    });
    return {
      items: normalized.map((email) => {
        const p = profiles.find((x) => x.email === email) ?? null;
        return { email, profile: p };
      }),
    };
  }

  async planRehearsal(dto: RehearsalPlanRequestDto) {
    const projectSlug = dto.projectSlug?.trim();
    if (!projectSlug) {
      throw new BadRequestException('projectSlug is required');
    }

    const presentRolesRaw: string[] = [];
    if (Array.isArray(dto.presentRoles))
      presentRolesRaw.push(...dto.presentRoles);
    if (Array.isArray(dto.presentPeople)) {
      dto.presentPeople.forEach((p) => {
        if (Array.isArray(p.roles)) presentRolesRaw.push(...p.roles);
      });
    }

    const presentNorm = new Set(
      presentRolesRaw.map(normalizeRole).filter(Boolean),
    );
    if (presentNorm.size === 0) {
      throw new BadRequestException(
        'presentRoles or presentPeople.roles must be provided',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        playbooks: {
          where: { deletedAt: null },
          select: { id: true, name: true, updatedAt: true },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const sceneRows = await this.prisma.scene.findMany({
      where: {
        playbookId: { in: project.playbooks.map((s) => s.id) },
        deletedAt: null,
      },
      select: {
        playbookId: true,
        sourceId: true,
        title: true,
        markdown: true,
        playMarkdown: true,
        kanbanStatus: true,
        kanbanOrder: true,
        order: true,
      },
      orderBy: [{ playbookId: 'asc' }, { order: 'asc' }],
    });
    const scenesByPlaybookId = new Map<string, typeof sceneRows>();
    for (const st of sceneRows) {
      const list = scenesByPlaybookId.get(st.playbookId) ?? [];
      list.push(st);
      scenesByPlaybookId.set(st.playbookId, list);
    }

    const items: Array<{
      projectSlug: string;
      playbookId: string;
      playbookName: string;
      sceneId: number | null;
      sceneTitle: string;
      requiredRoles: string[];
      missingRoles: string[];
      ready: boolean;
      kanbanStatus?: string;
      kanbanOrder?: number;
    }> = [];

    for (const playbook of project.playbooks) {
      const scenes = scenesByPlaybookId.get(playbook.id) ?? [];
      for (const scene of scenes) {
        const text = scene.playMarkdown ?? scene.markdown ?? '';
        const requiredRoles = extractRolesSmart(text);

        if (requiredRoles.length === 0) {
          items.push({
            projectSlug: project.slug,
            playbookId: playbook.id,
            playbookName: playbook.name,
            sceneId: typeof scene.sourceId === 'number' ? scene.sourceId : null,
            sceneTitle:
              (scene.title ?? '').trim() ||
              `Scene ${String(scene.sourceId ?? '')}`.trim(),
            requiredRoles: [],
            missingRoles: [],
            ready: true,
            kanbanStatus: scene.kanbanStatus ?? undefined,
            kanbanOrder: scene.kanbanOrder ?? undefined,
          });
          continue;
        }

        const roleNormToOriginal = new Map<string, string>();
        requiredRoles.forEach((r) => {
          const n = normalizeRole(r);
          if (!n) return;
          if (!roleNormToOriginal.has(n)) roleNormToOriginal.set(n, r);
        });

        const missingNorm = [...roleNormToOriginal.keys()].filter(
          (n) => !presentNorm.has(n),
        );
        const missingRoles = missingNorm
          .map((n) => roleNormToOriginal.get(n) ?? n)
          .sort((a, b) => a.localeCompare(b, 'ru'));

        items.push({
          projectSlug: project.slug,
          playbookId: playbook.id,
          playbookName: playbook.name,
          sceneId: typeof scene.sourceId === 'number' ? scene.sourceId : null,
          sceneTitle:
            (scene.title ?? '').trim() ||
            `Scene ${String(scene.sourceId ?? '')}`.trim(),
          requiredRoles: requiredRoles.sort((a, b) => a.localeCompare(b, 'ru')),
          missingRoles,
          ready: missingRoles.length === 0,
          kanbanStatus: scene.kanbanStatus ?? undefined,
          kanbanOrder: scene.kanbanOrder ?? undefined,
        });
      }
    }

    // Сортировка: сначала доступные, потом "почти", потом остальные
    items.sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? -1 : 1;
      if (a.missingRoles.length !== b.missingRoles.length) {
        return a.missingRoles.length - b.missingRoles.length;
      }
      const aa = `${a.playbookName} ${a.sceneTitle}`;
      const bb = `${b.playbookName} ${b.sceneTitle}`;
      return aa.localeCompare(bb, 'ru');
    });

    return {
      project: { id: project.id, slug: project.slug, name: project.name },
      presentRoles: Array.from(presentNorm),
      items,
    };
  }

  async listUpcomingCalls(botIntegrationId: string) {
    const id = String(botIntegrationId ?? '').trim();
    if (!id) throw new BadRequestException('botIntegrationId is required');
    const info = await this.getIntegration(id);
    const ownerUserId = String(info.integration?.ownerUserId ?? '').trim();
    const settings = parseCallNotifySettings(info.integration);
    if (!ownerUserId || settings.mode === 'on_publish') {
      return { items: [] as Array<Record<string, string>> };
    }

    const today = moscowDateKey();
    const horizonDays = settings.mode === 'advance' ? settings.advanceDays : 0;
    const from = new Date(`${today}T00:00:00+03:00`);
    const toKey = shiftDateKey(today, Math.max(horizonDays, 1) + 1);
    const to = new Date(`${toKey}T23:59:59+03:00`);

    const sessions = await this.prisma.directorSession.findMany({
      where: {
        userId: ownerUserId,
        startsAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        projectId: true,
        startsAt: true,
        title: true,
        payload: true,
      },
      orderBy: { startsAt: 'asc' },
      take: 200,
    });

    const sessionIds = new Set<string>();
    const items: Array<{
      kind: 'director-session' | 'rehearsal';
      id: string;
      projectId: string;
      startsAt: string;
      title: string;
    }> = [];

    for (const row of sessions) {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      const publishedAt = String(payload.publishedAt ?? '').trim();
      const telegramMessageId = String(payload.telegramMessageId ?? '').trim();
      if (!publishedAt || telegramMessageId) continue;
      if (!isScheduledCallDue(row.startsAt, settings)) continue;
      sessionIds.add(row.id);
      items.push({
        kind: 'director-session',
        id: row.id,
        projectId: row.projectId,
        startsAt: row.startsAt.toISOString(),
        title: String(row.title ?? payload.title ?? 'Сессия'),
      });
    }

    const prefs = await this.prisma.projectTelegramBotPreference.findMany({
      where: { botIntegrationId: id },
      select: { projectId: true },
    });
    const projectIds = Array.from(
      new Set(prefs.map((pref) => String(pref.projectId ?? '').trim()).filter(Boolean)),
    );
    const rehearsalWhere =
      projectIds.length > 0
        ? {
            publishedAt: { not: null },
            startsAt: { gte: from, lte: to },
            OR: [{ projectId: { in: projectIds } }, { createdBy: ownerUserId }],
          }
        : {
            publishedAt: { not: null },
            startsAt: { gte: from, lte: to },
            createdBy: ownerUserId,
          };

    const rehearsals = await this.prisma.rehearsal.findMany({
      where: rehearsalWhere,
      select: {
        id: true,
        projectId: true,
        startsAt: true,
        title: true,
        telegramMessageId: true,
        directorSession: { select: { id: true } },
      },
      orderBy: { startsAt: 'asc' },
      take: 200,
    });

    for (const rehearsal of rehearsals) {
      if (sessionIds.has(rehearsal.id) || rehearsal.directorSession) continue;
      if (String(rehearsal.telegramMessageId ?? '').trim()) continue;
      if (!isScheduledCallDue(rehearsal.startsAt, settings)) continue;
      items.push({
        kind: 'rehearsal',
        id: rehearsal.id,
        projectId: rehearsal.projectId,
        startsAt: rehearsal.startsAt.toISOString(),
        title: rehearsal.title,
      });
    }

    return { items };
  }

  async listAvailabilityGaps(botIntegrationId: string) {
    const id = String(botIntegrationId ?? '').trim();
    if (!id) throw new BadRequestException('botIntegrationId is required');
    const info = await this.getIntegration(id);
    const ownerUserId = String(info.integration?.ownerUserId ?? '').trim();
    const settings = parseCallNotifySettings(info.integration);
    if (!ownerUserId) return { items: [] };
    const items = await collectMonthAvailabilityGaps(this.prisma, ownerUserId);
    return {
      enabled: settings.availabilityRemindEnabled,
      items,
    };
  }
}
