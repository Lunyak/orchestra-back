import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

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
  lateTime?: string | null;
  respondedAt?: string | null;
};
type DirectorRehearsalSession = {
  id: string;
  title: string;
  startsAt: string; // ISO
  slots: DirectorSessionSlot[];
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

function getDateKey(dateIso: string): string {
  const d = new Date(dateIso);
  if (!Number.isFinite(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

  private async loadSessionsSceneByProjectId(projectId: string) {
    const sceneId = `${projectId}:sessions`;
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      select: { id: true, name: true, rawJson: true, projectId: true },
    });
    if (!scene) throw new NotFoundException('Sessions scene not found');
    const raw = (scene.rawJson as any) ?? {};
    const sessions = Array.isArray(raw.sessions) ? (raw.sessions as any[]) : [];
    return { sceneId, scene, raw, sessions };
  }

  private async saveSessionsScene(
    projectId: string,
    sessions: DirectorRehearsalSession[],
  ) {
    const sceneId = `${projectId}:sessions`;
    await this.prisma.scene.upsert({
      where: { id: sceneId },
      update: { name: 'sessions', rawJson: { sessions } as any },
      create: {
        id: sceneId,
        name: 'sessions',
        rawJson: { sessions } as any,
        projectId,
      },
    });
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
        select: { id: true, rawJson: true },
      })) ??
      (await this.prisma.scene.findFirst({
        where: { projectId, deletedAt: null },
        select: { id: true, rawJson: true },
      }));
    const raw = (scene?.rawJson as any) ?? {};
    const steps: RawStepLike[] = Array.isArray(raw?.steps) ? raw.steps : [];
    const roleAssignments = raw?.roleAssignments ?? {};
    const raIndex = normalizeRoleAssignmentsIndex(roleAssignments);
    return { steps, raIndex };
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

    // gather needed emails from roleAssignments per project
    const neededEmails = new Set<string>();
    const allowedEmails = new Set<string>();

    for (const slug of slugs) {
      const project = await this.assertUserHasProjectAccessBySlug(userId, slug);

      // union project members/emails for later filtering
      const p = await this.prisma.project.findUnique({
        where: { id: project.id },
        select: {
          owner: { select: { email: true } },
          members: { select: { user: { select: { email: true } } } },
        },
      });
      const memberEmails = [
        normEmail(p?.owner?.email ?? ''),
        ...((p?.members ?? []).map((m: any) =>
          normEmail(m?.user?.email),
        ) as string[]),
      ].filter(Boolean);
      memberEmails.forEach((e) => allowedEmails.add(normEmail(e)));

      const { steps, raIndex } = await this.loadProjectScriptData(project.id);
      const stepById = new Map<number, RawStepLike>();
      steps.forEach((st) => {
        if (typeof st?.id === 'number') stepById.set(st.id, st);
      });

      const slotRefs = refs.filter((r) => r.projectSlug === slug);
      for (const ref of slotRefs) {
        const step = stepById.get(ref.stepId);
        const text = String(step?.playMarkdown ?? step?.markdown ?? '');
        const roles = extractRolesSmart(text);
        for (const role of roles) {
          const key = normalizeRoleKey(role);
          if (!key) continue;
          const actors = raIndex.get(key) ?? [];
          for (const a of actors) {
            const v = String(a ?? '').trim();
            if (!looksLikeEmail(v)) continue;
            neededEmails.add(normEmail(v));
          }
        }
      }
    }

    const effectiveNeeded = Array.from(neededEmails).filter((e) =>
      allowedEmails.has(normEmail(e)),
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
        telegramId: true,
      },
    });

    const present = profiles
      .map((p) => {
        const email = normEmail(p.email);
        const calendar = p.availabilityCalendar ?? {};
        const st = calendar?.[dateKey];
        if (st !== 'present') return null;
        const userName =
          String(p.displayName ?? '').trim() ||
          [p.firstName, p.lastName]
            .map((x) => String(x ?? '').trim())
            .filter(Boolean)
            .join(' ') ||
          null;
        return {
          email,
          status: 'unknown' as const,
          userName,
          telegramId: p.telegramId ? String(p.telegramId).trim() || null : null,
        };
      })
      .filter(Boolean) as DirectorSessionParticipant[];

    if (present.length === 0) {
      throw new BadRequestException(
        `Нельзя опубликовать сессию: среди нужных по слотам никто не отметил присутствие в профиле на ${dateKey}`,
      );
    }
    return present;
  }

  async publish(userId: string, sessionId: string) {
    const sessId = String(sessionId ?? '').trim();
    if (!sessId) throw new BadRequestException('session id is required');

    const directorProject = await this.getDirectorProjectForUser(userId);
    const { sessions } = await this.loadSessionsSceneByProjectId(
      directorProject.id,
    );
    const idx = sessions.findIndex((s) => String(s?.id) === sessId);
    if (idx === -1) throw new NotFoundException('Session not found');

    const session = sessions[idx] as DirectorRehearsalSession;
    if (session.telegramMessageId) {
      return { ok: true, published: session };
    }

    const participants = await this.buildParticipantsForSession(
      userId,
      session,
    );
    const nowIso = new Date().toISOString();
    const updated: DirectorRehearsalSession = {
      ...session,
      participants,
      updatedAt: nowIso,
    };
    const nextSessions = [...sessions];
    nextSessions[idx] = updated;
    await this.saveSessionsScene(directorProject.id, nextSessions as any);

    const botUrl =
      this.config.get<string>('BOT_INTERNAL_URL') || 'http://bot:3001';
    const secret =
      this.config.get<string>('BOT_INTERNAL_SECRET') ||
      this.config.get<string>('INTERNAL_API_SECRET');
    if (!secret) {
      throw new BadRequestException(
        'Bot internal secret is not configured (set BOT_INTERNAL_SECRET in back env)',
      );
    }

    try {
      await axios.post(
        `${botUrl.replace(/\/$/, '')}/internal/publish-director-session`,
        { projectId: directorProject.id, sessionId: sessId },
        { headers: { 'X-Internal-Secret': secret } },
      );
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.response?.data?.description ||
        e?.message ||
        'Unknown error';
      throw new BadRequestException(
        `Bot publish failed${status ? ` (HTTP ${status})` : ''}: ${String(msg)}`,
      );
    }
    return { ok: true };
  }

  /** Для бота: получить сессию с участниками и резолвом слотов */
  async getForBot(projectId: string, sessionId: string) {
    const pid = String(projectId ?? '').trim();
    const sid = String(sessionId ?? '').trim();
    if (!pid || !sid)
      throw new BadRequestException('projectId and sessionId are required');
    const { sessions } = await this.loadSessionsSceneByProjectId(pid);
    const session = sessions.find((s) => String(s?.id) === sid) as
      | DirectorRehearsalSession
      | undefined;
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
    const base = new Date(session.startsAt);
    const baseMin = Number.isFinite(base.getTime())
      ? base.getHours() * 60 + base.getMinutes()
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
    const { sessions } = await this.loadSessionsSceneByProjectId(pid);
    const idx = sessions.findIndex((s) => String(s?.id) === sid);
    if (idx === -1) throw new NotFoundException('Session not found');
    const now = new Date().toISOString();
    const next = [...sessions];
    const cur = next[idx] as DirectorRehearsalSession;
    next[idx] = {
      ...cur,
      telegramChatId: String(dto.chatId ?? '').trim() || null,
      telegramMessageId: String(dto.messageId ?? '').trim() || null,
      telegramThreadId:
        dto.threadId != null ? String(dto.threadId).trim() || null : null,
      publishedAt: now,
      updatedAt: now,
    };
    await this.saveSessionsScene(pid, next as any);
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

    const { sessions } = await this.loadSessionsSceneByProjectId(pid);
    const idx = sessions.findIndex((s) => String(s?.id) === sid);
    if (idx === -1) throw new NotFoundException('Session not found');

    const nowIso = new Date().toISOString();
    const cur = sessions[idx] as DirectorRehearsalSession;
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
    const nextSessions = [...sessions];
    nextSessions[idx] = {
      ...cur,
      participants: nextParticipants,
      updatedAt: nowIso,
    };
    await this.saveSessionsScene(pid, nextSessions as any);
    return { ok: true };
  }
}
