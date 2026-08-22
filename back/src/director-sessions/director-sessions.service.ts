import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { extractRoleKeysFromSceneRoles } from '../playbook/scene-roles-data';
import { UpsertMyDirectorSessionCommentDto } from './dto/upsert-my-director-session-comment.dto';
import { ProjectAccessService } from '../project-access/project-access.service';
import { touchProjectActivity } from '../projects/project-activity';
import { MessengerBridgeService } from '../messenger-bots/messenger-bridge.service';

type DirectorSlotRef = { projectSlug: string; sceneId: number };
type DirectorSlotRoleRehearsalPick = {
  roleKey: string;
  email: string;
  checked?: boolean;
};
type DirectorSessionSlot = {
  id: string;
  offsetMin: number;
  durationMin: number;
  title?: string;
  ref?: DirectorSlotRef;
  notes?: string;
  participantEmails?: string[];
  roleRehearsalPicks?: DirectorSlotRoleRehearsalPick[];
};
type DirectorSessionParticipantStatus =
  | 'unknown'
  | 'present'
  | 'absent'
  | 'late';
type DirectorSessionParticipant = {
  email: string;
  status: DirectorSessionParticipantStatus;
  telegramId?: string | null;
  userName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  lateTime?: string | null;
  respondedAt?: string | null;
  /** HH:MM — время подхода (первый слот актёра). */
  callTime?: string | null;
};
type DirectorRehearsalSession = {
  id: string;
  title: string;
  startsAt: string; // ISO
  theaterId?: string;
  projectSlugs?: string[];
  slots: DirectorSessionSlot[];
  comment?: string | null;
  plannedEmails?: string[];
  updatedAt?: string;
  participants?: DirectorSessionParticipant[];
  telegramChatId?: string | null;
  telegramMessageId?: string | null;
  telegramThreadId?: string | null;
  publishedAt?: string | null;
};

type RawSceneLike = {
  id?: number;
  title?: string;
  markdown?: string;
  playMarkdown?: string;
};

const DEFAULT_TZ = 'Europe/Moscow';

function originFromWebDomain(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    return s.replace(/\/+$/, '');
  }
  const isLocalHostish =
    s === 'localhost' ||
    s.startsWith('127.0.0.1') ||
    s.startsWith('192.168.') ||
    s.startsWith('10.');
  const scheme = isLocalHostish ? 'http' : 'https';
  return `${scheme}://${s}`.replace(/\/+$/, '');
}

function normalizeAppBasePath(raw: string): string {
  const s = String(raw ?? '').trim() || '/orkestr';
  const withLead = s.startsWith('/') ? s : `/${s}`;
  return withLead.replace(/\/+$/, '') || '/orkestr';
}

function buildOrchestraAppUrl(base: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(String(value ?? '').trim());
}

function slugifyEmail(email: string): string {
  return String(email ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function directorSessionsProjectSlug(email: string): string {
  const s = slugifyEmail(email);
  return `__director_sessions__${s || 'me'}`;
}

function normEmail(v: string): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

function looksLikeEmail(v: string): boolean {
  return /.+@.+\..+/.test(v);
}

function normalizePlannedEmails(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value.slice(0, 800)) {
    const e = normEmail(String(item ?? ''));
    if (!e) continue;
    if (!looksLikeEmail(e)) continue;
    out.push(e);
  }
  const uniq = Array.from(new Set(out)).slice(0, 500);
  return uniq.length ? uniq : [];
}

function isRoleRehearsalPickChecked(
  p: DirectorSlotRoleRehearsalPick | undefined,
): boolean {
  if (!p) return false;
  const c = (p as { checked?: unknown }).checked;
  return c === true || c === 1;
}

function sessionPayloadInvitesEmail(
  cur: DirectorRehearsalSession | undefined,
  email: string,
): boolean {
  if (!cur || !email) return false;
  const planned = Array.isArray(cur.plannedEmails) ? cur.plannedEmails : [];
  if (planned.some((x) => normEmail(String(x ?? '')) === email)) return true;
  const parts = Array.isArray(cur.participants) ? cur.participants : [];
  if (parts.some((p) => normEmail(String((p as any)?.email ?? '')) === email))
    return true;
  for (const sl of cur.slots ?? []) {
    const participantEmails = Array.isArray(sl.participantEmails)
      ? sl.participantEmails
      : [];
    if (
      participantEmails.some(
        (item) => normEmail(String(item ?? '')) === email,
      )
    ) {
      return true;
    }
    const picks = (sl as DirectorSessionSlot).roleRehearsalPicks;
    if (!Array.isArray(picks)) continue;
    for (const p of picks) {
      if (!isRoleRehearsalPickChecked(p)) continue;
      if (normEmail(String(p.email ?? '')) === email) return true;
    }
  }
  return false;
}

function getDatePartsInTimeZone(
  dateIso: string,
  timeZone: string = DEFAULT_TZ,
): { yyyy: string; mm: string; dd: string; hh: string; min: string } | null {
  const d = new Date(dateIso);
  if (!Number.isFinite(d.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('ru-RU', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const byType = (t: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === t)?.value ?? '';
    const yyyy = byType('year');
    const mm = byType('month');
    const dd = byType('day');
    const hh = byType('hour');
    const min = byType('minute');
    if (!yyyy || !mm || !dd || !hh || !min) return null;
    return { yyyy, mm, dd, hh, min };
  } catch {
    return null;
  }
}

function getDateKey(dateIso: string): string {
  const p = getDatePartsInTimeZone(dateIso);
  if (!p) return '';
  return `${p.yyyy}-${p.mm}-${p.dd}`;
}

function parseTimeHHMM(src: string): number | null {
  const s = String(src ?? '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function profileHasSpecifiedAvailabilityForDate(
  profile: any,
  dateKey: string,
): boolean {
  if (!profile || !dateKey) return false;
  const day = profile?.availabilityCalendar?.[dateKey];
  if (day === 'present' || day === 'absent') return true;
  const ranges = profile?.availabilityTimeRanges?.[dateKey];
  if (!Array.isArray(ranges) || ranges.length === 0) return false;
  for (const item of ranges.slice(0, 20)) {
    const fromMin = parseTimeHHMM(String(item?.from ?? ''));
    const toMin = parseTimeHHMM(String(item?.to ?? ''));
    if (fromMin == null || toMin == null) continue;
    if (fromMin >= toMin) continue;
    return true;
  }
  return false;
}

/** Для строгого вызова: только день «свободен». */
function profileIsFreeForCall(profile: any, dateKey: string): boolean {
  if (!profile || !dateKey) return false;
  return profile?.availabilityCalendar?.[dateKey] === 'present';
}

function normalizeRoleKey(v: string): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[_\-.]+/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractRolesByBrackets(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const role = (m[1] ?? '').trim();
    if (role) out.push(role);
  }
  return Array.from(new Set(out));
}

function extractSpeakerRolesFromLines(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('==') || line.startsWith('(')) continue;
    const m1 = line.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.-]{1,40})\s*[:—-]\s+\S/);
    if (m1?.[1]) {
      const role = m1[1].replace(/\s+/g, ' ').trim();
      if (role.length >= 2 && role.length <= 40) out.push(role);
      continue;
    }
    const m2 = line.match(/^([A-ZА-ЯЁ]{2,40})([.,!?:])\s+/);
    if (m2?.[1]) out.push(m2[1].trim());
  }
  return Array.from(new Set(out));
}

function extractRolesSmart(text?: string): string[] {
  return Array.from(
    new Set([
      ...extractRolesByBrackets(text),
      ...extractSpeakerRolesFromLines(text),
    ]),
  )
    .map((x) => String(x ?? '').trim())
    .filter(Boolean);
}

function normalizeRoleAssignmentsIndex(
  roleAssignments: any,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!roleAssignments || typeof roleAssignments !== 'object') return map;
  for (const [role, list] of Object.entries(roleAssignments)) {
    const key = normalizeRoleKey(role);
    if (!key) continue;
    const actors = Array.isArray(list)
      ? list.map((x) => String(x ?? '').trim()).filter(Boolean)
      : [];
    if (actors.length) map.set(key, Array.from(new Set(actors)));
  }
  return map;
}

@Injectable()
export class DirectorSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly roles: RolesService,
    private readonly projectAccess: ProjectAccessService,
    private readonly messengerBridge: MessengerBridgeService,
  ) {}

  private orchestraAppBase(): string {
    const webDomain = String(this.config.get<string>('WEB_DOMAIN') ?? '').trim();
    const origin = webDomain
      ? originFromWebDomain(webDomain)
      : 'http://localhost:5173';
    const basePath = normalizeAppBasePath(
      String(this.config.get<string>('APP_BASE_PATH') ?? '/orkestr'),
    );
    return `${origin}${basePath}`;
  }

  private buildProjectSceneBoardUrl(
    appBase: string,
    projectSlug: string,
    sceneId: number,
  ): string {
    const slug = String(projectSlug ?? '').trim();
    if (!slug || !Number.isFinite(sceneId)) return '';
    return buildOrchestraAppUrl(
      appBase,
      `/projects/${encodePathSegment(slug)}/board?scene=${Math.floor(sceneId)}`,
    );
  }

  private async resolvePrimaryProjectSlugForSession(
    session: DirectorRehearsalSession,
    slotSlugs: string[],
    directorProjectId: string,
  ): Promise<string | null> {
    for (const slug of slotSlugs) {
      const value = String(slug ?? '').trim();
      if (value) return value;
    }
    for (const slug of session.projectSlugs ?? []) {
      const value = String(slug ?? '').trim();
      if (value) return value;
    }
    const project = await this.prisma.project.findFirst({
      where: { id: directorProjectId, deletedAt: null },
      select: { slug: true },
    });
    const slug = String(project?.slug ?? '').trim();
    return slug || null;
  }

  private async buildDirectorSessionAppUrl(
    appBase: string,
    session: DirectorRehearsalSession,
    sessionId: string,
    slotSlugs: string[],
    directorProjectId: string,
  ): Promise<string | null> {
    const theaterId = String(session.theaterId ?? '').trim();
    const sid = String(sessionId ?? '').trim();
    if (!sid) return null;
    if (theaterId) {
      return buildOrchestraAppUrl(
        appBase,
        `/organizations/theaters/${encodePathSegment(theaterId)}/rehearsals/${encodePathSegment(sid)}`,
      );
    }
    const primarySlug = await this.resolvePrimaryProjectSlugForSession(
      session,
      slotSlugs,
      directorProjectId,
    );
    if (!primarySlug) return null;
    return buildOrchestraAppUrl(
      appBase,
      `/projects/${encodePathSegment(primarySlug)}/sessions/${encodePathSegment(sid)}`,
    );
  }

  private async getDirectorProjectForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const email = String(user?.email ?? '')
      .trim()
      .toLowerCase();
    if (!email) throw new BadRequestException('User email not found');
    const slug = directorSessionsProjectSlug(email);
    try {
      const { project } = await this.projectAccess.assertBySlug(
        userId,
        slug,
        'owner',
      );
      return project;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException('Director sessions project not found');
      }
      throw error;
    }
  }

  private normalizeSessionInput(raw: any): DirectorRehearsalSession | null {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id ?? '').trim();
    const title = String(raw.title ?? '').trim() || 'Сессия';
    const startsAt = String(raw.startsAt ?? '').trim();
    const d = new Date(startsAt);
    if (!id || !Number.isFinite(d.getTime())) return null;
    const slots = Array.isArray(raw.slots) ? (raw.slots as any[]) : [];
    const commentRaw = raw.comment;
    const comment =
      commentRaw == null
        ? null
        : String(commentRaw).trim().slice(0, 4000) || null;
    const payload: DirectorRehearsalSession = {
      id,
      title,
      startsAt,
      theaterId: String(raw.theaterId ?? '').trim() || undefined,
      projectSlugs: Array.isArray(raw.projectSlugs)
        ? Array.from(
            new Set(
              raw.projectSlugs
                .map((slug: unknown) => String(slug ?? '').trim())
                .filter(Boolean),
            ),
          )
        : undefined,
      slots: slots as any,
      comment,
      plannedEmails: normalizePlannedEmails(raw.plannedEmails),
      updatedAt: String(raw.updatedAt ?? '').trim() || new Date().toISOString(),
      participants: Array.isArray(raw.participants)
        ? raw.participants
        : undefined,
      telegramChatId: raw.telegramChatId ?? null,
      telegramMessageId: raw.telegramMessageId ?? null,
      telegramThreadId: raw.telegramThreadId ?? null,
      publishedAt: raw.publishedAt ?? null,
    };
    return payload;
  }

  private async getSessionRow(projectId: string, sessionId: string) {
    return this.prisma.directorSession.findFirst({
      where: { projectId, id: sessionId },
      select: {
        id: true,
        userId: true,
        title: true,
        startsAt: true,
        payload: true,
      },
    });
  }

  private async upsertSessionRow(
    projectId: string,
    userId: string,
    session: DirectorRehearsalSession,
  ) {
    const startsAt = new Date(session.startsAt);
    await this.prisma.$transaction(async (tx) => {
      await this.syncCanonicalRehearsal(tx, projectId, userId, session);
      await tx.directorSession.upsert({
        where: { id: session.id },
        update: {
          projectId,
          userId,
          title: session.title,
          startsAt,
          payload: session as any,
        },
        create: {
          id: session.id,
          projectId,
          userId,
          title: session.title,
          startsAt,
          payload: session as any,
        },
      });
    });
    await touchProjectActivity(this.prisma, projectId);
  }

  private async syncCanonicalRehearsal(
    tx: Prisma.TransactionClient,
    directorProjectId: string,
    userId: string,
    session: DirectorRehearsalSession,
  ) {
    const projectSlugs = Array.from(
      new Set(
        [
          ...(session.projectSlugs ?? []),
          ...session.slots.map((slot) => slot.ref?.projectSlug ?? ''),
        ]
          .map((slug) => slug.trim())
          .filter((slug): slug is string => Boolean(slug)),
      ),
    );
    const matchedProjects = projectSlugs.length
      ? await tx.project.findMany({
          where: { slug: { in: projectSlugs }, deletedAt: null },
          select: {
            id: true,
            slug: true,
            workspaceId: true,
            theaters: {
              select: {
                theater: { select: { workspaceId: true } },
              },
            },
          },
        })
      : [];
    const projectsBySlug = new Map(
      matchedProjects.map((project) => [project.slug, project]),
    );
    const projects = projectSlugs.flatMap((slug) => {
      const project = projectsBySlug.get(slug);
      return project ? [project] : [];
    });
    const primaryProjectId = projects[0]?.id ?? directorProjectId;
    const rehearsalProjectIds = projects.length
      ? projects.map((project) => project.id)
      : [directorProjectId];
    const calendarWorkspaceIds = Array.from(
      new Set(
        projects.flatMap((project) => [
          project.workspaceId,
          ...project.theaters.map(({ theater }) => theater.workspaceId),
        ]),
      ),
    );
    if (session.theaterId) {
      const theater = await tx.theater.findFirst({
        where: {
          id: session.theaterId,
          workspace: {
            memberships: {
              some: { userId, role: { in: ['OWNER', 'ADMIN'] } },
            },
          },
        },
        select: { workspaceId: true },
      });
      if (!theater) {
        throw new ForbiddenException('Cannot manage this theater');
      }
      calendarWorkspaceIds.push(theater.workspaceId);
    }
    const directorWorkspace = calendarWorkspaceIds.length
      ? null
      : await tx.project.findUnique({
          where: { id: directorProjectId },
          select: { workspaceId: true },
        });
    if (directorWorkspace) {
      calendarWorkspaceIds.push(directorWorkspace.workspaceId);
    }
    const durationMin = session.slots.reduce(
      (maximum, slot) =>
        Math.max(maximum, slot.offsetMin + slot.durationMin),
      0,
    );
    const publishedAt = session.publishedAt
      ? new Date(session.publishedAt)
      : null;

    await tx.rehearsal.upsert({
      where: { id: session.id },
      update: {
        projectId: primaryProjectId,
        title: session.title,
        startsAt: new Date(session.startsAt),
        durationMin: durationMin || null,
        publishedAt,
        createdBy: userId,
        createdVia: 'director-session',
      },
      create: {
        id: session.id,
        projectId: primaryProjectId,
        title: session.title,
        startsAt: new Date(session.startsAt),
        durationMin: durationMin || null,
        publishedAt,
        createdBy: userId,
        createdVia: 'director-session',
      },
    });
    await tx.rehearsalProject.deleteMany({
      where: { rehearsalId: session.id },
    });
    await tx.rehearsalProject.createMany({
      data: rehearsalProjectIds.map((projectId) => ({
        rehearsalId: session.id,
        projectId,
      })),
      skipDuplicates: true,
    });
    await tx.rehearsalWorkspace.deleteMany({
      where: { rehearsalId: session.id },
    });
    await tx.rehearsalWorkspace.createMany({
      data: calendarWorkspaceIds.map((workspaceId) => ({
        rehearsalId: session.id,
        workspaceId,
      })),
      skipDuplicates: true,
    });
  }

  async list(userId: string) {
    const directorProject = await this.getDirectorProjectForUser(userId);
    const rows = await this.prisma.directorSession.findMany({
      where: { projectId: directorProject.id, userId },
      select: { id: true, payload: true },
      orderBy: [{ order: 'asc' }, { startsAt: 'asc' }],
    });
    return {
      projectId: directorProject.id,
      sessions: rows.map((r) => r.payload ?? { id: r.id }),
    };
  }

  /**
   * Сессии чужих режиссёров: email в plannedEmails, participants или отмеченных
   * roleRehearsalPicks слотов; только с publishedAt.
   * Для календаря занятости приглашённого актёра.
   */
  async listPublishedInvitationsForEmail(
    _userId: string,
    userEmail: string | undefined,
    fromIso?: string,
    toIso?: string,
  ) {
    const email = normEmail(String(userEmail ?? ''));
    if (!email) return { sessions: [] as DirectorRehearsalSession[] };

    const fromRaw = String(fromIso ?? '').trim();
    const toRaw = String(toIso ?? '').trim();
    let from: Date;
    let to: Date;
    if (fromRaw && toRaw) {
      from = new Date(fromRaw);
      to = new Date(toRaw);
      if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
        throw new BadRequestException('fromIso or toIso is invalid');
      }
    } else {
      const now = new Date();
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      to = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + 2,
          0,
          23,
          59,
          59,
          999,
        ),
      );
    }

    /** Пока без JSON-индекса: узкий диапазон дат + лимит; фильтр по email в памяти. */
    const rows = await this.prisma.directorSession.findMany({
      where: { startsAt: { gte: from, lte: to } },
      select: { id: true, payload: true },
      orderBy: { startsAt: 'asc' },
      take: 2500,
    });

    const sessions = rows
      .map((r) => r.payload as any as DirectorRehearsalSession | undefined)
      .filter((cur): cur is DirectorRehearsalSession => {
        if (!cur || !String((cur as any).publishedAt ?? '').trim())
          return false;
        return sessionPayloadInvitesEmail(cur, email);
      });

    return { sessions };
  }

  /**
   * Сессия: владелец (режиссёр) или приглашённый (participants / plannedEmails / picks).
   */
  async get(
    userId: string,
    userEmail: string | undefined,
    sessionId: string,
  ): Promise<DirectorRehearsalSession> {
    const sid = String(sessionId ?? '').trim();
    if (!sid) throw new BadRequestException('session id is required');

    const directorProject = await this.getDirectorProjectForUser(userId);
    const owned = await this.prisma.directorSession.findFirst({
      where: { projectId: directorProject.id, userId, id: sid },
      select: { payload: true },
    });
    if (owned)
      return (owned.payload ?? { id: sid }) as DirectorRehearsalSession;

    const email = normEmail(String(userEmail ?? ''));
    if (!email) throw new NotFoundException('Session not found');

    const row = await this.prisma.directorSession.findFirst({
      where: { id: sid },
      select: { payload: true },
    });
    const cur = row?.payload as any as DirectorRehearsalSession | undefined;
    if (!cur) throw new NotFoundException('Session not found');

    if (!sessionPayloadInvitesEmail(cur, email)) {
      throw new ForbiddenException('Нет доступа к этой сессии');
    }
    if (!String((cur as any).publishedAt ?? '').trim()) {
      throw new ForbiddenException('Сессия ещё не опубликована');
    }
    return cur;
  }

  /**
   * Участник отвечает на вызов: participants[].status = present | absent.
   */
  private async setMyAttendanceStatus(
    userEmail: string | undefined,
    sessionId: string,
    status: 'present' | 'absent',
  ) {
    const sid = String(sessionId ?? '').trim();
    const email = normEmail(String(userEmail ?? ''));
    if (!sid || !email) {
      throw new BadRequestException('session id and email required');
    }

    const row = await this.prisma.directorSession.findFirst({
      where: { id: sid },
      select: { projectId: true, userId: true, payload: true },
    });
    if (!row) throw new NotFoundException('Session not found');

    const cur = row.payload as any as DirectorRehearsalSession | undefined;
    if (!cur) throw new NotFoundException('Session not found');
    if (!String((cur as any).publishedAt ?? '').trim()) {
      throw new ForbiddenException('Сессия ещё не опубликована');
    }

    const participants = Array.isArray(cur.participants)
      ? [...cur.participants]
      : [];
    const pIdx = participants.findIndex(
      (p: any) => normEmail(String(p?.email ?? '')) === email,
    );
    if (pIdx === -1) {
      throw new ForbiddenException(
        'Вы не в списке участников этой сессии (он формируется после публикации).',
      );
    }

    const nowIso = new Date().toISOString();
    participants[pIdx] = {
      ...participants[pIdx],
      status,
      respondedAt: nowIso,
    };
    const updated: DirectorRehearsalSession = {
      ...cur,
      participants,
      updatedAt: nowIso,
    };
    await this.upsertSessionRow(row.projectId, row.userId, updated);
    return { ok: true, session: updated };
  }

  /** Участник подтверждает явку (participants[].status = present). */
  async confirmMyAttendance(
    _userId: string,
    userEmail: string | undefined,
    sessionId: string,
  ) {
    return this.setMyAttendanceStatus(userEmail, sessionId, 'present');
  }

  /** Участник отклоняет явку / отмечает «не приду» (participants[].status = absent). */
  async declineMyAttendance(
    _userId: string,
    userEmail: string | undefined,
    sessionId: string,
  ) {
    return this.setMyAttendanceStatus(userEmail, sessionId, 'absent');
  }

  async getMyComment(userId: string, sessionId: string) {
    const directorProject = await this.getDirectorProjectForUser(userId);
    const sid = String(sessionId ?? '').trim();
    if (!sid) throw new BadRequestException('session id is required');
    const exists = await this.prisma.directorSession.findFirst({
      where: { projectId: directorProject.id, userId, id: sid },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Session not found');

    const comment = await this.prisma.directorSessionComment.findUnique({
      where: {
        sessionId_authorUserId: { sessionId: sid, authorUserId: userId },
      },
      select: { id: true, content: true, createdAt: true, updatedAt: true },
    });
    return { comment: comment ?? null };
  }

  async upsertMyComment(
    userId: string,
    userEmail: string,
    sessionId: string,
    dto: UpsertMyDirectorSessionCommentDto,
  ) {
    const directorProject = await this.getDirectorProjectForUser(userId);
    const sid = String(sessionId ?? '').trim();
    if (!sid) throw new BadRequestException('session id is required');
    const exists = await this.prisma.directorSession.findFirst({
      where: { projectId: directorProject.id, userId, id: sid },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Session not found');

    const email = String(userEmail ?? '')
      .trim()
      .toLowerCase();
    if (!email) throw new BadRequestException('Invalid user email');

    const content = String(dto?.content ?? '').trim();
    if (!content) {
      await this.prisma.directorSessionComment.deleteMany({
        where: { sessionId: sid, authorUserId: userId },
      });
      return { comment: null };
    }

    const comment = await this.prisma.directorSessionComment.upsert({
      where: {
        sessionId_authorUserId: { sessionId: sid, authorUserId: userId },
      },
      update: { content, authorEmail: email },
      create: {
        sessionId: sid,
        authorUserId: userId,
        authorEmail: email,
        content,
      },
      select: { id: true, content: true, createdAt: true, updatedAt: true },
    });
    return { comment };
  }

  async replaceAll(userId: string, body: { sessions?: any[] }) {
    const directorProject = await this.getDirectorProjectForUser(userId);
    const sessionsIn = Array.isArray(body?.sessions) ? body.sessions : [];
    const sessions = sessionsIn
      .map((s) => this.normalizeSessionInput(s))
      .filter(Boolean) as DirectorRehearsalSession[];

    const ids = Array.from(new Set(sessions.map((s) => s.id))).filter(Boolean);
    await this.prisma.$transaction(async (tx) => {
      const removedSessions = await tx.directorSession.findMany({
        where: {
          projectId: directorProject.id,
          userId,
          ...(ids.length ? { id: { notIn: ids } } : {}),
        },
        select: { id: true },
      });
      await tx.directorSession.deleteMany({
        where: {
          projectId: directorProject.id,
          userId,
          ...(ids.length ? { id: { notIn: ids } } : {}),
        },
      });
      if (removedSessions.length) {
        await tx.rehearsal.deleteMany({
          where: {
            id: { in: removedSessions.map(({ id }) => id) },
            createdVia: 'director-session',
          },
        });
      }
      for (let i = 0; i < sessions.length; i += 1) {
        let s = sessions[i];
        const existing = await tx.directorSession.findUnique({
          where: { id: s.id },
          select: { payload: true },
        });
        const prev = existing?.payload as any as
          | DirectorRehearsalSession
          | undefined;
        if (prev) {
          const incomingPub = String((s as any).publishedAt ?? '').trim();
          if (!incomingPub && String((prev as any).publishedAt ?? '').trim()) {
            s = { ...s, publishedAt: (prev as any).publishedAt };
          }
        }
        await this.syncCanonicalRehearsal(
          tx,
          directorProject.id,
          userId,
          s,
        );
        await tx.directorSession.upsert({
          where: { id: s.id },
          update: {
            projectId: directorProject.id,
            userId,
            order: i,
            title: s.title,
            startsAt: new Date(s.startsAt),
            payload: s as any,
          },
          create: {
            id: s.id,
            projectId: directorProject.id,
            userId,
            order: i,
            title: s.title,
            startsAt: new Date(s.startsAt),
            payload: s as any,
          },
        });
      }
    });
    await touchProjectActivity(this.prisma, directorProject.id);
    return { ok: true };
  }

  private async loadSessionsSceneByProjectId(projectId: string) {
    const sessions = await this.prisma.directorSession.findMany({
      where: { projectId },
      select: { id: true, payload: true },
      orderBy: [{ order: 'asc' }, { startsAt: 'asc' }],
    });
    return {
      sessions: sessions.map((r) => r.payload ?? { id: r.id }),
    };
  }

  private async saveSessionsScene(
    projectId: string,
    sessions: DirectorRehearsalSession[],
  ) {
    // legacy no-op: sessions are stored in DirectorSession table now
    void projectId;
    void sessions;
  }

  private async loadProjectScriptData(projectId: string) {
    const playbookId = `${projectId}:script`;
    const playbook =
      (await this.prisma.playbook.findUnique({
        where: { id: playbookId },
        select: { id: true, sceneRoles: true },
      })) ??
      (await this.prisma.playbook.findFirst({
        where: { projectId, deletedAt: null },
        select: { id: true, sceneRoles: true },
      }));

    const sceneRows = await this.prisma.scene.findMany({
      where: { playbookId: playbook?.id ?? playbookId, deletedAt: null },
      select: {
        sourceId: true,
        title: true,
        markdown: true,
        playMarkdown: true,
        order: true,
      },
      orderBy: { order: 'asc' },
    });
    const scenes: RawSceneLike[] = sceneRows.map((st) => ({
      id: st.sourceId,
      title: st.title,
      markdown: st.markdown ?? undefined,
      playMarkdown: st.playMarkdown ?? undefined,
    }));

    return { scenes, sceneRoles: (playbook as any)?.sceneRoles ?? null };
  }

  /**
   * Режиссёр, публикующий сессию, считается подтвердившим явку (не зависит от «Свободен» в профиле).
   */
  private async buildDirectorSelfParticipant(
    userId: string,
  ): Promise<DirectorSessionParticipant | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const email = normEmail(String(user?.email ?? ''));
    if (!email) return null;

    const p =
      (await this.prisma.userProfile.findUnique({
        where: { email },
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          telegramId: true,
        },
      })) ?? null;

    const firstName = String(p?.firstName ?? '').trim() || null;
    const lastName = String(p?.lastName ?? '').trim() || null;
    const userName =
      String(p?.displayName ?? '').trim() ||
      [firstName, lastName].filter(Boolean).join(' ') ||
      null;
    const nowIso = new Date().toISOString();

    return {
      email,
      status: 'present',
      userName,
      firstName,
      lastName,
      avatarUrl: String(p?.avatarUrl ?? '').trim() || null,
      telegramId: p?.telegramId ? String(p.telegramId).trim() || null : null,
      respondedAt: nowIso,
    };
  }

  /** Сформировать участников по слотам сессии. */
  private async buildParticipantsForSession(
    userId: string,
    session: DirectorRehearsalSession,
    opts?: { includeUnavailable?: boolean },
  ): Promise<{
    participants: DirectorSessionParticipant[];
    neededEmails: string[];
  }> {
    const includeUnavailable = Boolean(opts?.includeUnavailable);
    const needed = await this.collectNeededEmailsForSession(userId, session);
    const dateKey = getDateKey(session.startsAt);
    if (!dateKey) throw new BadRequestException('Invalid session startsAt');

    const profiles = await this.prisma.userProfile.findMany({
      where: { email: { in: needed } },
      select: {
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        telegramId: true,
        availabilityCalendar: true,
      },
    });
    const profileByEmail = new Map(
      profiles.map((p) => [normEmail(p.email), p] as const),
    );

    const directorSelf = await this.buildDirectorSelfParticipant(userId);
    const directorEmail = directorSelf ? normEmail(directorSelf.email) : '';

    const mergedByEmail = new Map<string, DirectorSessionParticipant>();
    for (const rawEmail of needed) {
      const email = normEmail(rawEmail);
      if (!email || !looksLikeEmail(email)) continue;
      const p = profileByEmail.get(email);
      if (!includeUnavailable) {
        const isDirector = Boolean(directorEmail && email === directorEmail);
        if (!isDirector && !profileIsFreeForCall(p, dateKey)) continue;
      }
      const firstName = String(p?.firstName ?? '').trim() || null;
      const lastName = String(p?.lastName ?? '').trim() || null;
      const userName =
        String(p?.displayName ?? '').trim() ||
        [firstName, lastName].filter(Boolean).join(' ') ||
        null;
      mergedByEmail.set(email, {
        email,
        status: 'unknown',
        userName,
        firstName,
        lastName,
        avatarUrl: String(p?.avatarUrl ?? '').trim() || null,
        telegramId: p?.telegramId ? String(p.telegramId).trim() || null : null,
      });
    }

    if (directorSelf) {
      const prev = mergedByEmail.get(directorSelf.email);
      mergedByEmail.set(directorSelf.email, {
        ...(prev ?? { email: directorSelf.email }),
        ...directorSelf,
        status: 'present',
        respondedAt: directorSelf.respondedAt,
      });
    }

    const callTimeByEmail = await this.computeActorCallTimeByEmail(
      userId,
      session,
    );
    const merged = Array.from(mergedByEmail.values()).map((p) => {
      const email = normEmail(p.email);
      const callTime = callTimeByEmail.get(email) ?? null;
      return { ...p, callTime };
    });
    merged.sort((a, b) => {
      const ta = String(a.callTime ?? '').trim();
      const tb = String(b.callTime ?? '').trim();
      if (ta && tb) return ta.localeCompare(tb) || a.email.localeCompare(b.email);
      if (ta) return -1;
      if (tb) return 1;
      return a.email.localeCompare(b.email);
    });
    if (merged.length === 0) {
      throw new BadRequestException(
        includeUnavailable
          ? `Нельзя опубликовать сессию: по слотам не нашлось актёров на ${dateKey}`
          : `Нельзя опубликовать сессию: никто из нужных актёров не отметил «свободен» на ${dateKey}. Включите тогл «звать без занятости» или попросите отметить день.`,
      );
    }
    return { participants: merged, neededEmails: needed };
  }

  private async collectNeededEmailsForSession(
    userId: string,
    session: DirectorRehearsalSession,
  ): Promise<string[]> {
    const customSlots = (session.slots ?? []).filter(
      (slot) => !slot.ref && Boolean(String(slot.title ?? '').trim()),
    );
    const refs = (session.slots ?? [])
      .map((s) => s.ref)
      .filter(Boolean) as DirectorSlotRef[];
    const slugs = Array.from(new Set(refs.map((r) => r.projectSlug))).filter(
      Boolean,
    );
    if (slugs.length === 0 && customSlots.length === 0) {
      throw new BadRequestException(
        'Перед публикацией выберите материал или укажите название слота',
      );
    }

    const neededEmails = new Set<string>();

    for (const slot of customSlots) {
      const participantEmails = Array.isArray(slot.participantEmails)
        ? slot.participantEmails
        : [];
      for (const value of participantEmails) {
        const email = normEmail(String(value ?? ''));
        if (!email || !looksLikeEmail(email)) continue;
        neededEmails.add(email);
      }
    }

    for (const slug of slugs) {
      const { project } = await this.projectAccess.assertBySlug(
        userId,
        slug,
        'read',
      );
      const { scenes, sceneRoles } = await this.loadProjectScriptData(
        project.id,
      );
      const sceneById = new Map<number, RawSceneLike>();
      scenes.forEach((st) => {
        if (typeof st?.id === 'number') sceneById.set(st.id, st);
      });

      const slotRefs = refs.filter((r) => r.projectSlug === slug);
      for (const ref of slotRefs) {
        const scene = sceneById.get(ref.sceneId);
        const attachedKeys = extractRoleKeysFromSceneRoles(
          sceneRoles,
          ref.sceneId,
          normalizeRoleKey,
        );
        const roleKeys =
          attachedKeys.length > 0
            ? attachedKeys
            : extractRolesSmart(
                String(scene?.playMarkdown ?? scene?.markdown ?? ''),
              )
                .map((r) => normalizeRoleKey(r))
                .filter(Boolean);
        const assignmentMap = await this.roles.resolveAssignmentsByRoleKeys(
          project.id,
          roleKeys,
        );
        for (const key of roleKeys) {
          const emails = assignmentMap.get(key) ?? [];
          for (const email of emails) neededEmails.add(normEmail(email));
        }
      }
    }

    for (const sl of session.slots ?? []) {
      const picks = (sl as DirectorSessionSlot).roleRehearsalPicks;
      if (Array.isArray(picks)) {
        for (const p of picks) {
          if (!isRoleRehearsalPickChecked(p)) continue;
          const em = normEmail(String(p.email ?? ''));
          if (em && looksLikeEmail(em)) neededEmails.add(em);
        }
      }
      for (const value of sl.participantEmails ?? []) {
        const em = normEmail(String(value ?? ''));
        if (em && looksLikeEmail(em)) neededEmails.add(em);
      }
    }

    for (const value of session.plannedEmails ?? []) {
      const em = normEmail(String(value ?? ''));
      if (em && looksLikeEmail(em)) neededEmails.add(em);
    }

    // В вызов идут все назначенные на роли / выбранные в слотах.
    // Фильтр труппы больше не отрезает актёров (из‑за него в Telegram
    // часто оставался только режиссёр).
    const result = Array.from(neededEmails).filter(Boolean);
    if (result.length === 0) {
      if (customSlots.length > 0) return [];
      throw new BadRequestException(
        `Нельзя опубликовать сессию: не нашли emails актёров по roleAssignments (или нет доступа к ним)`,
      );
    }
    return result;
  }

  private collectEmailsOnSlotFromPayload(slot: DirectorSessionSlot): string[] {
    const emails = new Set<string>();
    for (const value of slot.participantEmails ?? []) {
      const email = normEmail(String(value ?? ''));
      if (email && looksLikeEmail(email)) emails.add(email);
    }
    for (const pick of slot.roleRehearsalPicks ?? []) {
      if (!isRoleRehearsalPickChecked(pick)) continue;
      const email = normEmail(String(pick.email ?? ''));
      if (email && looksLikeEmail(email)) emails.add(email);
    }
    return Array.from(emails);
  }

  private async collectEmailsForDirectorSlot(
    userId: string,
    slot: DirectorSessionSlot,
    scriptCache: Map<
      string,
      {
        projectId: string;
        sceneRoles: unknown;
        sceneById: Map<number, RawSceneLike>;
      }
    >,
    assignmentCache: Map<string, Map<string, string[]>>,
  ): Promise<string[]> {
    const emails = new Set<string>(this.collectEmailsOnSlotFromPayload(slot));
    const ref = slot.ref;
    if (!ref?.projectSlug || ref.sceneId == null) {
      return Array.from(emails);
    }

    const slug = String(ref.projectSlug).trim();
    let cached = scriptCache.get(slug);
    if (!cached) {
      try {
        const { project } = await this.projectAccess.assertBySlug(
          userId,
          slug,
          'read',
        );
        const { scenes, sceneRoles } = await this.loadProjectScriptData(
          project.id,
        );
        const sceneById = new Map<number, RawSceneLike>();
        scenes.forEach((st) => {
          if (typeof st?.id === 'number') sceneById.set(st.id, st);
        });
        cached = { projectId: project.id, sceneRoles, sceneById };
        scriptCache.set(slug, cached);
      } catch {
        return Array.from(emails);
      }
    }

    const scene = cached.sceneById.get(ref.sceneId);
    const attachedKeys = extractRoleKeysFromSceneRoles(
      cached.sceneRoles as any,
      ref.sceneId,
      normalizeRoleKey,
    );
    const roleKeys =
      attachedKeys.length > 0
        ? attachedKeys
        : extractRolesSmart(
            String(scene?.playMarkdown ?? scene?.markdown ?? ''),
          )
            .map((r) => normalizeRoleKey(r))
            .filter(Boolean);

    let assignmentMap = assignmentCache.get(cached.projectId);
    if (!assignmentMap) {
      assignmentMap = new Map<string, string[]>();
      assignmentCache.set(cached.projectId, assignmentMap);
    }

    const picks = slot.roleRehearsalPicks ?? [];
    for (const key of roleKeys) {
      if (!key) continue;
      const rolePicks = picks.filter(
        (p) => normalizeRoleKey(String(p.roleKey ?? '')) === key,
      );
      if (rolePicks.length > 0) {
        for (const p of rolePicks) {
          if (!isRoleRehearsalPickChecked(p)) continue;
          const em = normEmail(String(p.email ?? ''));
          if (em && looksLikeEmail(em)) emails.add(em);
        }
        // Если пики есть, но ни один не отмечен — берём назначения ролей.
        const hadChecked = rolePicks.some((p) => isRoleRehearsalPickChecked(p));
        if (!hadChecked) {
          if (!assignmentMap.has(key)) {
            const resolved = await this.roles.resolveAssignmentsByRoleKeys(
              cached.projectId,
              [key],
            );
            assignmentMap.set(key, resolved.get(key) ?? []);
          }
          for (const raw of assignmentMap.get(key) ?? []) {
            const em = normEmail(String(raw ?? ''));
            if (em && looksLikeEmail(em)) emails.add(em);
          }
        }
      } else {
        if (!assignmentMap.has(key)) {
          const resolved = await this.roles.resolveAssignmentsByRoleKeys(
            cached.projectId,
            [key],
          );
          assignmentMap.set(key, resolved.get(key) ?? []);
        }
        for (const raw of assignmentMap.get(key) ?? []) {
          const em = normEmail(String(raw ?? ''));
          if (em && looksLikeEmail(em)) emails.add(em);
        }
      }
    }

    return Array.from(emails);
  }

  private async computeActorCallTimeByEmail(
    userId: string,
    session: DirectorRehearsalSession,
  ): Promise<Map<string, string>> {
    const offsetByEmail = new Map<string, number>();
    const scriptCache = new Map<
      string,
      {
        projectId: string;
        sceneRoles: unknown;
        sceneById: Map<number, RawSceneLike>;
      }
    >();
    const assignmentCache = new Map<string, Map<string, string[]>>();

    for (const sl of session.slots ?? []) {
      const offset = Math.max(0, Math.floor((sl as DirectorSessionSlot).offsetMin ?? 0));
      const slotEmails = await this.collectEmailsForDirectorSlot(
        userId,
        sl as DirectorSessionSlot,
        scriptCache,
        assignmentCache,
      );
      for (const raw of slotEmails) {
        const email = normEmail(raw);
        if (!email) continue;
        const prev = offsetByEmail.get(email);
        if (prev == null || offset < prev) offsetByEmail.set(email, offset);
      }
    }

    const baseParts = getDatePartsInTimeZone(session.startsAt);
    const baseMin =
      baseParts && /^\d{2}$/.test(baseParts.hh) && /^\d{2}$/.test(baseParts.min)
        ? Number(baseParts.hh) * 60 + Number(baseParts.min)
        : 0;
    const toHHMM = (min: number) => {
      const m = ((Math.floor(min) % (24 * 60)) + 24 * 60) % (24 * 60);
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      return `${hh}:${mm}`;
    };

    const result = new Map<string, string>();
    for (const [email, offset] of offsetByEmail) {
      result.set(email, toHHMM(baseMin + offset));
    }
    return result;
  }

  async remindMissingAvailability(userId: string, sessionId: string) {
    const sid = String(sessionId ?? '').trim();
    if (!sid) throw new BadRequestException('session id is required');
    const directorProject = await this.getDirectorProjectForUser(userId);
    const row = await this.getSessionRow(directorProject.id, sid);
    const session = row?.payload as any as DirectorRehearsalSession | undefined;
    if (!session) throw new NotFoundException('Session not found');

    const dateKey = getDateKey(session.startsAt);
    if (!dateKey) throw new BadRequestException('Invalid session startsAt');

    const neededEmails = await this.collectNeededEmailsForSession(
      userId,
      session,
    );
    const profiles = await this.prisma.userProfile.findMany({
      where: { email: { in: neededEmails } },
      select: {
        email: true,
        telegramId: true,
        displayName: true,
        firstName: true,
        lastName: true,
        availabilityCalendar: true,
        availabilityTimeRanges: true,
      },
    });
    const profileByEmail = new Map<string, any>();
    for (const profile of profiles) {
      const email = normEmail(String(profile?.email ?? ''));
      if (email) profileByEmail.set(email, profile);
    }

    const recipients: Array<{
      telegramId: string;
      email: string;
      name?: string;
    }> = [];
    let totalWithoutAvailability = 0;
    for (const email of neededEmails) {
      const profile = profileByEmail.get(normEmail(email));
      if (profileHasSpecifiedAvailabilityForDate(profile, dateKey)) continue;
      totalWithoutAvailability += 1;
      const telegramId = String(profile?.telegramId ?? '').trim();
      if (!telegramId) continue;
      const name =
        String(profile?.displayName ?? '').trim() ||
        [profile?.firstName, profile?.lastName]
          .map((v) => String(v ?? '').trim())
          .filter(Boolean)
          .join(' ')
          .trim() ||
        undefined;
      recipients.push({ telegramId, email, name });
    }

    if (recipients.length === 0) {
      return {
        ok: true,
        sentCount: 0,
        skippedCount: totalWithoutAvailability,
        totalWithoutAvailability,
      };
    }

    const botUrl =
      this.config.get<string>('BOT_INTERNAL_URL') || 'http://bot:3001';
    const secret = String(
      this.config.get<string>('INTERNAL_API_SECRET') ?? '',
    ).trim();
    if (!secret) {
      throw new BadRequestException('INTERNAL_API_SECRET is not configured');
    }
    const pref = await this.prisma.projectTelegramBotPreference.findUnique({
      where: { projectId_userId: { projectId: directorProject.id, userId } },
      select: { botIntegrationId: true },
    });
    const botIntegrationId =
      String(pref?.botIntegrationId ?? '').trim() ||
      String(
        (
          await this.prisma.telegramBotIntegration.findFirst({
            where: { ownerUserId: userId, status: 'connected' },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
          })
        )?.id ?? '',
      ).trim();
    if (!botIntegrationId) {
      throw new BadRequestException('Не найден подключенный Telegram-бот');
    }

    const url = `${botUrl.replace(/\/$/, '')}/internal/remind-director-session-availability`;
    const payload = {
      projectId: directorProject.id,
      sessionId: sid,
      botIntegrationId,
      recipients,
    };
    const headers = { 'X-Internal-Secret': secret };

    let sentCount = 0;
    try {
      const res = await axios.post(url, payload, { headers });
      sentCount = Number(res?.data?.sentCount ?? 0) || 0;
    } catch (e) {
      const msg = String((e as any)?.message ?? 'Failed to send reminders');
      throw new BadRequestException(msg);
    }

    return {
      ok: true,
      sentCount,
      skippedCount: Math.max(0, totalWithoutAvailability - sentCount),
      totalWithoutAvailability,
    };
  }

  async publish(
    userId: string,
    sessionId: string,
    body?: { comment?: string; includeUnavailable?: boolean },
  ) {
    const sessId = String(sessionId ?? '').trim();
    if (!sessId) throw new BadRequestException('session id is required');

    const directorProject = await this.getDirectorProjectForUser(userId);
    const row = await this.getSessionRow(directorProject.id, sessId);
    const session = row?.payload as any as DirectorRehearsalSession | undefined;
    if (!session) throw new NotFoundException('Session not found');
    // NOTE: even if Telegram IDs exist, the message might have been deleted in Telegram.
    // We still call bot-service: it will try to edit existing message, and if it's gone
    // it will send a new one and overwrite Telegram IDs via markTelegramPublished.

    const nextComment =
      body && Object.prototype.hasOwnProperty.call(body, 'comment')
        ? String((body as any)?.comment ?? '')
            .trim()
            .slice(0, 4000) || null
        : (session.comment ?? null);

    const includeUnavailable = Boolean(
      (body as { includeUnavailable?: unknown } | undefined)?.includeUnavailable,
    );

    const { participants, neededEmails } =
      await this.buildParticipantsForSession(userId, session, {
        includeUnavailable,
      });
    const plannedSet = new Set<string>();
    for (const e of normalizePlannedEmails(session.plannedEmails) ?? []) {
      plannedSet.add(normEmail(e));
    }
    for (const e of neededEmails) {
      const n = normEmail(e);
      if (n) plannedSet.add(n);
    }
    const mergedPlanned = Array.from(plannedSet).filter((e) =>
      looksLikeEmail(e),
    );
    const nowIso = new Date().toISOString();
    const updated: DirectorRehearsalSession = {
      ...session,
      comment: nextComment,
      participants,
      plannedEmails: mergedPlanned,
      publishedAt: nowIso,
      updatedAt: nowIso,
    };
    await this.upsertSessionRow(directorProject.id, userId, updated);

    const botUrl =
      this.config.get<string>('BOT_INTERNAL_URL') || 'http://bot:3001';
    const secret = String(
      this.config.get<string>('INTERNAL_API_SECRET') ?? '',
    ).trim();

    const pref = await this.prisma.projectTelegramBotPreference.findUnique({
      where: { projectId_userId: { projectId: directorProject.id, userId } },
      select: { botIntegrationId: true },
    });
    const botIntegrationId =
      String(pref?.botIntegrationId ?? '').trim() ||
      String(
        (
          await this.prisma.telegramBotIntegration.findFirst({
            where: { ownerUserId: userId, status: 'connected' },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
          })
        )?.id ?? '',
      ).trim();

    let telegramSent = false;
    if (secret && botIntegrationId) {
      try {
        console.log('[director-sessions] publish via bot', {
          projectId: directorProject.id,
          sessionId: sessId,
          botUrl,
          botIntegrationId,
        });
        const url = `${botUrl.replace(/\/$/, '')}/internal/publish-director-session`;
        const payload = {
          projectId: directorProject.id,
          sessionId: sessId,
          botIntegrationId,
        };
        const headers = { 'X-Internal-Secret': secret };

        const delaysMs = [200, 800, 2000];
        let lastErr: any = null;
        for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
          try {
            await axios.post(url, payload, { headers });
            lastErr = null;
            telegramSent = true;
            break;
          } catch (e: any) {
            lastErr = e;
            const msg = String(e?.message ?? '');
            const code = String(e?.code ?? '');
            const isDns =
              code === 'EAI_AGAIN' ||
              /EAI_AGAIN/i.test(msg) ||
              code === 'ENOTFOUND';
            if (!isDns || attempt >= delaysMs.length) break;
            await new Promise((r) => setTimeout(r, delaysMs[attempt]));
          }
        }
        if (lastErr) {
          console.warn(
            '[director-sessions] bot publish failed (сессия всё равно опубликована в приложении)',
            lastErr?.response?.status,
            lastErr?.response?.data ?? lastErr?.message ?? lastErr,
          );
        }
      } catch (e: any) {
        console.warn(
          '[director-sessions] bot publish error (сессия опубликована в приложении)',
          e?.response?.status,
          e?.response?.data ?? e?.message ?? e,
        );
      }
    } else {
      console.warn('[director-sessions] publish skipped: missing secret or botIntegrationId', {
        hasSecret: Boolean(secret),
        hasBotIntegrationId: Boolean(botIntegrationId),
      });
    }

    try {
      const title = String((updated as any)?.title ?? 'Сессия').trim();
      const when = String((updated as any)?.startsAt ?? '').trim();
      const announce = [`Orchestra: ${title}`, when ? `Когда: ${when}` : '']
        .filter(Boolean)
        .join('\n');
      if (announce) {
        await this.messengerBridge.publishText(userId, { text: announce });
      }
    } catch (e: any) {
      console.warn(
        '[director-sessions] messenger fan-out skipped',
        e?.message || e,
      );
    }

    return { ok: true, telegramSent, session: updated };
  }

  /** Для бота: получить сессию с участниками и резолвом слотов */
  async getForBot(projectId: string, sessionId: string) {
    const pid = String(projectId ?? '').trim();
    const sid = String(sessionId ?? '').trim();
    if (!pid || !sid)
      throw new BadRequestException('projectId and sessionId are required');
    const row = await this.getSessionRow(pid, sid);
    const session = row?.payload as any as DirectorRehearsalSession | undefined;
    if (!session) throw new NotFoundException('Session not found');

    const refs = (session.slots ?? [])
      .map((s) => s.ref)
      .filter(Boolean) as DirectorSlotRef[];
    const slugs = Array.from(new Set(refs.map((r) => r.projectSlug))).filter(
      Boolean,
    );
    const projectBySlug = new Map<
      string,
      { id: string; slug: string; name: string }
    >();
    const scenesBySlug = new Map<string, Map<number, RawSceneLike>>();

    for (const slug of slugs) {
      const project = await this.prisma.project.findFirst({
        where: { slug, deletedAt: null },
        select: { id: true, slug: true, name: true },
      });
      if (!project) continue;
      projectBySlug.set(slug, project);
      const { scenes } = await this.loadProjectScriptData(project.id);
      const map = new Map<number, RawSceneLike>();
      scenes.forEach((st) => {
        if (typeof st?.id === 'number') map.set(st.id, st);
      });
      scenesBySlug.set(slug, map);
    }

    const baseParts = getDatePartsInTimeZone(session.startsAt);
    const baseMin =
      baseParts && /^\d{2}$/.test(baseParts.hh) && /^\d{2}$/.test(baseParts.min)
        ? Number(baseParts.hh) * 60 + Number(baseParts.min)
        : 0;
    const toHHMM = (min: number) => {
      const m = ((Math.floor(min) % (24 * 60)) + 24 * 60) % (24 * 60);
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      return `${hh}:${mm}`;
    };

    const appBase = this.orchestraAppBase();
    const primarySlug = await this.resolvePrimaryProjectSlugForSession(
      session,
      slugs,
      pid,
    );
    const sessionUrl = await this.buildDirectorSessionAppUrl(
      appBase,
      session,
      sid,
      slugs,
      pid,
    );

    const resolvedSlots = (session.slots ?? []).map((sl) => {
      const offset = Math.max(0, Math.floor((sl as any)?.offsetMin ?? 0));
      const dur = Math.max(1, Math.floor((sl as any)?.durationMin ?? 1));
      const timeStart = toHHMM(baseMin + offset);
      const timeEnd = toHHMM(baseMin + offset + dur);
      const ref = sl.ref;
      if (!ref)
        return {
          ...sl,
          timeStart,
          timeEnd,
          projectSlug: null,
          projectName: null,
          sceneId: null,
          sceneTitle: String(sl.title ?? '').trim() || null,
          stepTitle: String(sl.title ?? '').trim() || null,
          sceneUrl: null,
        };
      const scene = scenesBySlug.get(ref.projectSlug)?.get(ref.sceneId);
      const slotTitle =
        String(sl.title ?? '').trim() || String(scene?.title ?? '').trim() || null;
      const projectName =
        String(projectBySlug.get(ref.projectSlug)?.name ?? '').trim() || null;
      const sceneUrl =
        this.buildProjectSceneBoardUrl(appBase, ref.projectSlug, ref.sceneId) ||
        null;
      return {
        ...sl,
        timeStart,
        timeEnd,
        projectSlug: ref.projectSlug,
        projectName,
        sceneId: ref.sceneId,
        sceneTitle: slotTitle,
        stepTitle: slotTitle,
        sceneUrl,
      };
    });

    const userId = String(row?.userId ?? '').trim();
    let enrichedParticipants = session.participants ?? [];
    if (userId) {
      const callTimeByEmail = await this.computeActorCallTimeByEmail(
        userId,
        session,
      );
      enrichedParticipants = (session.participants ?? []).map((p) => {
        const email = normEmail(String(p.email ?? ''));
        const callTime = callTimeByEmail.get(email) ?? null;
        return callTime ? { ...p, callTime } : { ...p, callTime: null };
      });
    }

    return {
      ...session,
      projectId: pid,
      primaryProjectSlug: primarySlug ?? null,
      sessionUrl: sessionUrl ?? null,
      slots: resolvedSlots,
      participants: enrichedParticipants,
    };
  }

  async markTelegramPublished(
    projectId: string,
    sessionId: string,
    dto: { chatId: string; messageId: string; threadId?: string },
  ) {
    const pid = String(projectId ?? '').trim();
    const sid = String(sessionId ?? '').trim();
    if (!pid || !sid)
      throw new BadRequestException('projectId and sessionId are required');
    const row = await this.getSessionRow(pid, sid);
    const cur = row?.payload as any as DirectorRehearsalSession | undefined;
    if (!cur || !row?.userId) throw new NotFoundException('Session not found');
    const now = new Date().toISOString();
    const updated: DirectorRehearsalSession = {
      ...cur,
      telegramChatId: String(dto.chatId ?? '').trim() || null,
      telegramMessageId: String(dto.messageId ?? '').trim() || null,
      telegramThreadId:
        dto.threadId != null ? String(dto.threadId).trim() || null : null,
      publishedAt: now,
      updatedAt: now,
    };
    await this.upsertSessionRow(pid, row.userId, updated);
    return { ok: true };
  }

  async upsertParticipantStatusFromBot(
    projectId: string,
    sessionId: string,
    dto: {
      telegramId: string;
      status: DirectorSessionParticipantStatus;
      userName?: string;
      lateTime?: string;
    },
  ) {
    const pid = String(projectId ?? '').trim();
    const sid = String(sessionId ?? '').trim();
    if (!pid || !sid)
      throw new BadRequestException('projectId and sessionId are required');
    const telegramId = String(dto.telegramId ?? '').trim();
    if (!telegramId) throw new BadRequestException('telegramId is required');

    const row = await this.getSessionRow(pid, sid);
    const cur = row?.payload as any as DirectorRehearsalSession | undefined;
    if (!cur || !row?.userId) throw new NotFoundException('Session not found');

    const nowIso = new Date().toISOString();
    const participants = Array.isArray(cur.participants)
      ? cur.participants
      : [];
    const pIdx = participants.findIndex(
      (p) => String(p?.telegramId ?? '') === telegramId,
    );
    if (pIdx === -1) {
      // если участника с telegramId нет (например, telegramId не записан), не падаем
      return { ok: true };
    }
    const nextParticipants = [...participants];
    nextParticipants[pIdx] = {
      ...nextParticipants[pIdx],
      status: dto.status ?? 'unknown',
      userName:
        dto.userName != null
          ? String(dto.userName).trim() || null
          : (nextParticipants[pIdx].userName ?? null),
      lateTime:
        dto.lateTime != null
          ? String(dto.lateTime).trim() || null
          : dto.status === 'late'
            ? (nextParticipants[pIdx].lateTime ?? null)
            : null,
      respondedAt: nowIso,
    };
    const updated: DirectorRehearsalSession = {
      ...cur,
      participants: nextParticipants,
      updatedAt: nowIso,
    };
    await this.upsertSessionRow(pid, row.userId, updated);
    return { ok: true };
  }
}
