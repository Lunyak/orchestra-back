import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { UpsertMyDirectorSessionCommentDto } from './dto/upsert-my-director-session-comment.dto';

type DirectorSlotRef = { projectSlug: string; stepId: number };
type DirectorSessionSlot = {
  id: string;
  offsetMin: number;
  durationMin: number;
  ref?: DirectorSlotRef;
  notes?: string;
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
};
type DirectorRehearsalSession = {
  id: string;
  title: string;
  startsAt: string; // ISO
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

type RawStepLike = {
  id?: number;
  title?: string;
  markdown?: string;
  playMarkdown?: string;
};

type SceneRoleLinkV1 = {
  roleId: string;
  roleKey?: string;
  roleTitle?: string;
  note?: string;
  createdAtIso?: string;
  updatedAtIso?: string;
};

type SceneRolesDataV1 = {
  v: 1;
  byStepId: Record<
    string,
    Record<string, SceneRoleLinkV1 | undefined> | undefined
  >;
};

const DEFAULT_TZ = 'Europe/Moscow';

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

function extractRoleKeysFromSceneRoles(
  sceneRoles: any,
  stepId: number,
): string[] {
  const sr = sceneRoles as SceneRolesDataV1 | null | undefined;
  if (!sr || typeof sr !== 'object' || (sr as any).v !== 1) return [];
  const byStepId = (sr as any).byStepId;
  if (!byStepId || typeof byStepId !== 'object') return [];
  const stepMap = byStepId[String(stepId)];
  if (!stepMap || typeof stepMap !== 'object') return [];
  const out: string[] = [];
  for (const it of Object.values(stepMap as Record<string, any>)) {
    if (!it || typeof it !== 'object') continue;
    const key =
      typeof it.roleKey === 'string' && it.roleKey.trim()
        ? normalizeRoleKey(it.roleKey)
        : typeof it.roleTitle === 'string' && it.roleTitle.trim()
          ? normalizeRoleKey(it.roleTitle)
          : null;
    if (key) out.push(key);
  }
  return Array.from(new Set(out)).filter(Boolean);
}

@Injectable()
export class DirectorSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly roles: RolesService,
  ) {}

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
    const project = await this.prisma.project.findFirst({
      where: { slug, ownerId: userId, deletedAt: null },
      select: { id: true, slug: true },
    });
    if (!project)
      throw new NotFoundException('Director sessions project not found');
    return project;
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
    await this.prisma.directorSession.upsert({
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
   * Сессии чужих режиссёров: email в plannedEmails или participants, только с publishedAt.
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
      to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59, 999));
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
        if (!cur || !String((cur as any).publishedAt ?? '').trim()) return false;
        const planned = Array.isArray((cur as any).plannedEmails)
          ? ((cur as any).plannedEmails as any[])
          : [];
        if (planned.some((x) => normEmail(String(x ?? '')) === email)) return true;
        const parts = Array.isArray((cur as any).participants)
          ? ((cur as any).participants as any[])
          : [];
        return parts.some((p) => normEmail(String(p?.email ?? '')) === email);
      });

    return { sessions };
  }

  /**
   * Сессия: владелец (режиссёр) или приглашённый (email в participants / plannedEmails).
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
    if (owned) return (owned.payload ?? { id: sid }) as DirectorRehearsalSession;

    const email = normEmail(String(userEmail ?? ''));
    if (!email) throw new NotFoundException('Session not found');

    const row = await this.prisma.directorSession.findFirst({
      where: { id: sid },
      select: { payload: true },
    });
    const cur = row?.payload as any as DirectorRehearsalSession | undefined;
    if (!cur) throw new NotFoundException('Session not found');

    const inParticipants = (cur.participants ?? []).some(
      (p: any) => normEmail(String(p?.email ?? '')) === email,
    );
    const plannedRaw = Array.isArray(cur.plannedEmails) ? cur.plannedEmails : [];
    const inPlanned = plannedRaw.some(
      (e: any) => normEmail(String(e ?? '')) === email,
    );
    if (!inParticipants && !inPlanned) {
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
      where: { sessionId_authorUserId: { sessionId: sid, authorUserId: userId } },
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

    const email = String(userEmail ?? '').trim().toLowerCase();
    if (!email) throw new BadRequestException('Invalid user email');

    const content = String(dto?.content ?? '').trim();
    if (!content) {
      await this.prisma.directorSessionComment.deleteMany({
        where: { sessionId: sid, authorUserId: userId },
      });
      return { comment: null };
    }

    const comment = await this.prisma.directorSessionComment.upsert({
      where: { sessionId_authorUserId: { sessionId: sid, authorUserId: userId } },
      update: { content, authorEmail: email },
      create: { sessionId: sid, authorUserId: userId, authorEmail: email, content },
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
      await tx.directorSession.deleteMany({
        where: {
          projectId: directorProject.id,
          userId,
          ...(ids.length ? { id: { notIn: ids } } : {}),
        },
      });
      for (let i = 0; i < sessions.length; i += 1) {
        let s = sessions[i];
        const existing = await tx.directorSession.findUnique({
          where: { id: s.id },
          select: { payload: true },
        });
        const prev = existing?.payload as any as DirectorRehearsalSession | undefined;
        if (prev) {
          const incomingPub = String((s as any).publishedAt ?? '').trim();
          if (!incomingPub && String((prev as any).publishedAt ?? '').trim()) {
            s = { ...s, publishedAt: (prev as any).publishedAt };
          }
        }
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
      select: { id: true, slug: true },
    });
    if (!project) throw new ForbiddenException('No access to project');
    return project;
  }

  private async loadProjectScriptData(projectId: string) {
    const sceneId = `${projectId}:script`;
    const scene =
      (await this.prisma.scene.findUnique({
        where: { id: sceneId },
        select: { id: true, sceneRoles: true },
      })) ??
      (await this.prisma.scene.findFirst({
        where: { projectId, deletedAt: null },
        select: { id: true, sceneRoles: true },
      }));

    const stepRows = await this.prisma.step.findMany({
      where: { sceneId: scene?.id ?? sceneId, deletedAt: null },
      select: {
        sourceId: true,
        title: true,
        markdown: true,
        playMarkdown: true,
        order: true,
      },
      orderBy: { order: 'asc' },
    });
    const steps: RawStepLike[] = stepRows.map((st) => ({
      id: st.sourceId,
      title: st.title,
      markdown: st.markdown ?? undefined,
      playMarkdown: st.playMarkdown ?? undefined,
    }));

    return { steps, sceneRoles: (scene as any)?.sceneRoles ?? null };
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

  /** Сформировать участников (neededEmails -> present profiles) по слотам сессии */
  private async buildParticipantsForSession(
    userId: string,
    session: DirectorRehearsalSession,
  ): Promise<DirectorSessionParticipant[]> {
    const dateKey = getDateKey(session.startsAt);
    if (!dateKey) throw new BadRequestException('Invalid session startsAt');

    const refs = (session.slots ?? [])
      .map((s) => s.ref)
      .filter(Boolean) as DirectorSlotRef[];
    const slugs = Array.from(new Set(refs.map((r) => r.projectSlug))).filter(
      Boolean,
    );
    if (slugs.length === 0) {
      throw new BadRequestException(
        'Перед публикацией выберите материалы (слоты)',
      );
    }

    // gather needed emails from RoleAssignments per project
    const neededEmails = new Set<string>();
    const allowedEmails = new Set<string>();

    // allowed: only people from my troupe (primary list for scheduling)
    const troupe = await this.prisma.troupe.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    if (troupe?.id) {
      const troupeMembers = await this.prisma.troupeMember.findMany({
        where: { troupeId: troupe.id },
        select: { email: true },
      });
      troupeMembers
        .map((m) => normEmail(m.email))
        .filter(Boolean)
        .forEach((e) => allowedEmails.add(e));
    }

    for (const slug of slugs) {
      const project = await this.assertUserHasProjectAccessBySlug(userId, slug);

      const { steps, sceneRoles } = await this.loadProjectScriptData(
        project.id,
      );
      const stepById = new Map<number, RawStepLike>();
      steps.forEach((st) => {
        if (typeof st?.id === 'number') stepById.set(st.id, st);
      });

      const slotRefs = refs.filter((r) => r.projectSlug === slug);
      for (const ref of slotRefs) {
        const step = stepById.get(ref.stepId);
        const attachedKeys = extractRoleKeysFromSceneRoles(
          sceneRoles,
          ref.stepId,
        );
        const roleKeys =
          attachedKeys.length > 0
            ? attachedKeys
            : extractRolesSmart(
                String(step?.playMarkdown ?? step?.markdown ?? ''),
              )
                .map((r) => normalizeRoleKey(r))
                .filter(Boolean);
        const assignmentMap = await this.roles.resolveAssignmentsByRoleKeys(
          project.id,
          roleKeys,
        );
        for (const k of roleKeys) {
          const emails = assignmentMap.get(k) ?? [];
          for (const e of emails) neededEmails.add(normEmail(e));
        }
      }
    }

    const effectiveNeeded = Array.from(neededEmails).filter((e) =>
      allowedEmails.size > 0 ? allowedEmails.has(normEmail(e)) : true,
    );
    if (effectiveNeeded.length === 0) {
      throw new BadRequestException(
        `Нельзя опубликовать сессию: не нашли emails актёров по roleAssignments (или нет доступа к ним)`,
      );
    }

    const profiles = await this.prisma.userProfile.findMany({
      where: { email: { in: effectiveNeeded } },
      select: {
        email: true,
        availabilityCalendar: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        telegramId: true,
      },
    });

    const present = profiles
      .map((p) => {
        const email = normEmail(p.email);
        const calendar = p.availabilityCalendar ?? {};
        const st = calendar?.[dateKey];
        if (st !== 'present') return null;
        const firstName = String(p.firstName ?? '').trim() || null;
        const lastName = String(p.lastName ?? '').trim() || null;
        const userName =
          String(p.displayName ?? '').trim() ||
          [firstName, lastName]
            .filter(Boolean)
            .join(' ') ||
          null;
        return {
          email,
          status: 'unknown' as const,
          userName,
          firstName,
          lastName,
          avatarUrl: String(p.avatarUrl ?? '').trim() || null,
          telegramId: p.telegramId ? String(p.telegramId).trim() || null : null,
        };
      })
      .filter(Boolean) as DirectorSessionParticipant[];

    const directorSelf = await this.buildDirectorSelfParticipant(userId);
    const mergedByEmail = new Map<string, DirectorSessionParticipant>();
    for (const row of present) {
      mergedByEmail.set(normEmail(row.email), row);
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

    const merged = Array.from(mergedByEmail.values());
    if (merged.length === 0) {
      throw new BadRequestException(
        `Нельзя опубликовать сессию: среди нужных по слотам никто не отметил присутствие в профиле на ${dateKey}`,
      );
    }
    return merged;
  }

  async publish(
    userId: string,
    sessionId: string,
    body?: { comment?: string },
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

    const participants = await this.buildParticipantsForSession(
      userId,
      session,
    );
    const nowIso = new Date().toISOString();
    const updated: DirectorRehearsalSession = {
      ...session,
      comment: nextComment,
      participants,
      publishedAt: nowIso,
      updatedAt: nowIso,
    };
    await this.upsertSessionRow(directorProject.id, userId, updated);

    const botUrl =
      this.config.get<string>('BOT_INTERNAL_URL') || 'http://bot:3001';
    const secret = String(this.config.get<string>('INTERNAL_API_SECRET') ?? '').trim();

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
            lastErr,
          );
        }
      } catch (e: any) {
        console.warn(
          '[director-sessions] bot publish error (сессия опубликована в приложении)',
          e,
        );
      }
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

    // resolve slot titles
    const refs = (session.slots ?? [])
      .map((s) => s.ref)
      .filter(Boolean) as DirectorSlotRef[];
    const slugs = Array.from(new Set(refs.map((r) => r.projectSlug))).filter(
      Boolean,
    );
    const projectBySlug = new Map<string, { id: string; slug: string }>();
    const stepsBySlug = new Map<string, Map<number, RawStepLike>>();

    for (const slug of slugs) {
      const project = await this.prisma.project.findFirst({
        where: { slug, deletedAt: null },
        select: { id: true, slug: true },
      });
      if (!project) continue;
      projectBySlug.set(slug, project);
      const { steps } = await this.loadProjectScriptData(project.id);
      const map = new Map<number, RawStepLike>();
      steps.forEach((st) => {
        if (typeof st?.id === 'number') map.set(st.id, st);
      });
      stepsBySlug.set(slug, map);
    }

    // local time labels (HH:MM) based on session.startsAt + offsetMin
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
          stepId: null,
          stepTitle: null,
        };
      const step = stepsBySlug.get(ref.projectSlug)?.get(ref.stepId);
      return {
        ...sl,
        timeStart,
        timeEnd,
        projectSlug: ref.projectSlug,
        stepId: ref.stepId,
        stepTitle: step?.title ?? null,
      };
    });

    return { ...session, projectId: pid, slots: resolvedSlots };
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
