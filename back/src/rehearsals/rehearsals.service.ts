import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { extractRoleKeysFromSceneRoles } from '../playbook/scene-roles-data';
import { parseSelectedScenesJson } from '../playbook/selected-scenes-json';
import { CreateRehearsalDto } from './dto/create-rehearsal.dto';
import { SetParticipantsDto } from './dto/set-participants.dto';
import { UpdateRehearsalDto } from './dto/update-rehearsal.dto';
import { UpsertMyRehearsalCommentDto } from './dto/upsert-my-rehearsal-comment.dto';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/ru';
import axios from 'axios';

dayjs.extend(customParseFormat);
dayjs.locale('ru');

function normEmail(v: string): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

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

function parseIsoDate(v: string): Date {
  const s = String(v ?? '').trim();
  if (!s) throw new BadRequestException('Invalid date');

  // Support:
  // - Date only: 2026-02-16
  // - Full ISO with offset: 2026-02-16T19:00:00.000+03:00
  // - Full ISO with Z: 2026-02-16T19:00:00.000Z (toISOString())
  // Keep strict formats first, then fallback to Dayjs native ISO parsing.
  const strict = dayjs(
    s,
    [
      'YYYY-MM-DD',
      'YYYY-MM-DDTHH:mm:ss.SSSZ',
      'YYYY-MM-DDTHH:mm:ssZ',
      'YYYY-MM-DDTHH:mm:ss.SSS[Z]',
      'YYYY-MM-DDTHH:mm:ss[Z]',
      'YYYY-MM-DDTHH:mm:ss.SSS',
      'YYYY-MM-DDTHH:mm:ss',
    ],
    true,
  );
  const d = strict.isValid() ? strict : dayjs(s);
  if (!d.isValid()) throw new BadRequestException('Invalid date');
  return d.toDate();
}

type RawSceneLike = {
  id?: number;
  title?: string;
  markdown?: string;
  playMarkdown?: string;
  durationMin?: number;
  kanbanStatus?: string;
  kanbanOrder?: number;
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function extractTimeHHMM(
  text?: string | null,
): { hh: number; mm: number } | null {
  const t = String(text ?? '').trim();
  if (!t) return null;
  const m = t.match(/\b([01]?\d|2[0-3])[:.](\d{2})\b/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function minutesToHHMM(min: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.floor(min)));
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
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
    if (line.startsWith('==') || line.startsWith('(')) continue;
    const m1 = line.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.-]{1,40})\s*[:—-]\s+\S/);
    if (m1?.[1]) {
      const role = m1[1].replace(/\s+/g, ' ').trim();
      if (role.length >= 2 && role.length <= 40) out.push(role);
      continue;
    }
    const m2 = line.match(/^([A-ZА-ЯЁ]{2,40})([.,!?:])\s+/);
    if (m2?.[1]) {
      out.push(m2[1].trim());
      continue;
    }
  }
  return uniq(out);
}

function extractRolesSmart(text?: string): string[] {
  return uniq([
    ...extractRolesByBrackets(text),
    ...extractSpeakerRolesFromLines(text),
  ]);
}

function getRoleTokensForScene(
  playbook: { sceneRoles?: any } | null,
  scene: {
    sourceId?: number;
    markdown?: string | null;
    playMarkdown?: string | null;
  },
): string[] {
  const sceneSourceId = typeof scene.sourceId === 'number' ? scene.sourceId : null;
  if (sceneSourceId != null) {
    const attached = extractRoleKeysFromSceneRoles(
      (playbook as any)?.sceneRoles,
      sceneSourceId,
      normalizeRoleKey,
    );
    if (attached.length > 0) return attached;
  }
  const text = scene.playMarkdown ?? scene.markdown ?? '';
  return extractRolesSmart(text);
}

function looksLikeEmail(v: string): boolean {
  return /.+@.+\..+/.test(v);
}

type AvailabilityCalendar = Record<string, 'present' | 'absent'>;

function getDateKey(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD');
}

function parseAvailabilityCalendar(value: unknown): AvailabilityCalendar {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: AvailabilityCalendar = {};
  for (const [date, rawStatus] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (rawStatus === 'present' || rawStatus === 'absent')
      out[date] = rawStatus;
  }
  return out;
}

function parseStringArrayJson(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((x) => String(x ?? '').trim()).filter(Boolean);
  }
  // Prisma JSONB может прийти как объект/строка — но нам нужен только массив
  return [];
}

@Injectable()
export class RehearsalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly roles: RolesService,
  ) {}

  private async assertUserHasProjectAccess(
    userId: string,
    projectId: string,
    write: boolean,
  ) {
    if (userId === 'bot') return;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        members: { where: { userId }, select: { role: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId === userId) return;
    if (!project.members.length)
      throw new ForbiddenException('No access to project');
    if (write && project.members[0]?.role !== 'editor') {
      throw new ForbiddenException('No write access to project');
    }
  }

  async list(userId: string, projectSlug: string, from?: string, to?: string) {
    const slug = String(projectSlug ?? '').trim();
    if (!slug) throw new BadRequestException('projectSlug is required');

    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        deletedAt: null,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true, slug: true, name: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const where: any = { projectId: project.id };
    if (from || to) {
      where.startsAt = {};
      if (from) where.startsAt.gte = parseIsoDate(from);
      if (to) where.startsAt.lte = parseIsoDate(to);
    }

    const rehearsals = await this.prisma.rehearsal.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      include: { participants: true },
    });

    return { project, rehearsals };
  }

  async create(userId: string, dto: CreateRehearsalDto, createdVia: string) {
    const slug = dto.projectSlug.trim();
    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        deletedAt: null,
        ...(userId === 'bot'
          ? {}
          : { OR: [{ ownerId: userId }, { members: { some: { userId } } }] }),
      },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    await this.assertUserHasProjectAccess(userId, project.id, true);

    const startsAt = parseIsoDate(dto.startsAt);
    const title = String(dto.title ?? '').trim();
    if (!title) throw new BadRequestException('title is required');

    return this.prisma.rehearsal.create({
      data: {
        projectId: project.id,
        title,
        startsAt,
        durationMin: dto.durationMin ?? null,
        notes: dto.notes?.trim() || null,
        createdBy: userId,
        createdVia,
      },
      include: { participants: true },
    });
  }

  async get(userId: string, id: string) {
    const reh = await this.prisma.rehearsal.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, slug: true, name: true } },
        participants: true,
      },
    });
    if (!reh) throw new NotFoundException('Rehearsal not found');
    await this.assertUserHasProjectAccess(userId, reh.projectId, false);
    return reh;
  }

  async getMyComment(userId: string, rehearsalId: string) {
    const reh = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      select: { id: true, projectId: true },
    });
    if (!reh) throw new NotFoundException('Rehearsal not found');
    await this.assertUserHasProjectAccess(userId, reh.projectId, false);

    const comment = await this.prisma.rehearsalComment.findUnique({
      where: { rehearsalId_authorUserId: { rehearsalId, authorUserId: userId } },
      select: { id: true, content: true, createdAt: true, updatedAt: true },
    });
    return { comment: comment ?? null };
  }

  async upsertMyComment(
    userId: string,
    userEmail: string,
    rehearsalId: string,
    dto: UpsertMyRehearsalCommentDto,
  ) {
    const reh = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      select: { id: true, projectId: true },
    });
    if (!reh) throw new NotFoundException('Rehearsal not found');
    await this.assertUserHasProjectAccess(userId, reh.projectId, false);

    const email = String(userEmail ?? '').trim().toLowerCase();
    if (!email) throw new BadRequestException('Invalid user email');

    const content = String(dto?.content ?? '').trim();
    if (!content) {
      await this.prisma.rehearsalComment.deleteMany({
        where: { rehearsalId, authorUserId: userId },
      });
      return { comment: null };
    }

    const comment = await this.prisma.rehearsalComment.upsert({
      where: { rehearsalId_authorUserId: { rehearsalId, authorUserId: userId } },
      update: { content, authorEmail: email },
      create: { rehearsalId, authorUserId: userId, authorEmail: email, content },
      select: { id: true, content: true, createdAt: true, updatedAt: true },
    });

    return { comment };
  }

  async update(userId: string, id: string, dto: UpdateRehearsalDto) {
    const reh = await this.prisma.rehearsal.findUnique({ where: { id } });
    if (!reh) throw new NotFoundException('Rehearsal not found');
    await this.assertUserHasProjectAccess(userId, reh.projectId, true);

    return this.prisma.rehearsal.update({
      where: { id },
      data: {
        title: dto.title != null ? dto.title.trim() : undefined,
        startsAt: dto.startsAt != null ? parseIsoDate(dto.startsAt) : undefined,
        durationMin: dto.durationMin != null ? dto.durationMin : undefined,
        notes: dto.notes != null ? dto.notes.trim() || null : undefined,
        selectedPlaybookIds:
          dto.selectedPlaybookIds != null
            ? dto.selectedPlaybookIds
                .map((x) => String(x ?? '').trim())
                .filter(Boolean)
            : undefined,
        selectedScenes:
          dto.selectedScenes != null
            ? parseSelectedScenesJson(dto.selectedScenes as any)
            : undefined,
      },
      include: { participants: true },
    });
  }

  async getScenesForRehearsal(userId: string, rehearsalId: string) {
    const reh = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      include: { project: { select: { id: true, slug: true, name: true } } },
    });
    if (!reh) throw new NotFoundException('Rehearsal not found');
    await this.assertUserHasProjectAccess(userId, reh.projectId, false);

    const playbooks = await this.prisma.playbook.findMany({ where: { projectId: reh.projectId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    const scenes = await this.prisma.scene.findMany({ where: { playbookId: { in: playbooks.map((s) => s.id) },
        deletedAt: null,
      },
      select: { playbookId: true, sourceId: true, title: true, order: true },
      orderBy: [{ playbookId: 'asc' }, { order: 'asc' }],
    });
    const scenesByPlaybookId = new Map<
      string,
      Array<{ id: number; title: string }>
    >();
    for (const st of scenes) {
      const list = scenesByPlaybookId.get(st.playbookId) ?? [];
      list.push({
        id: st.sourceId,
        title: String(st.title ?? '').trim() || `Scene ${st.sourceId}`,
      });
      scenesByPlaybookId.set(st.playbookId, list);
    }

    const selectedPlaybookIds = parseStringArrayJson(
      (reh as any)?.selectedPlaybookIds,
    );
    const selectedScenes = parseSelectedScenesJson((reh as any)?.selectedScenes);

    return {
      rehearsal: { id: reh.id, title: reh.title, startsAt: reh.startsAt },
      selectedPlaybookIds,
      selectedScenes,
      playbooks: playbooks.map((s) => {
        return {
          id: s.id,
          name: s.name,
          scenes: (scenesByPlaybookId.get(s.id) ?? []).slice(0, 200),
        };
      }),
    };
  }

  async setParticipants(
    userId: string,
    rehearsalId: string,
    dto: SetParticipantsDto,
  ) {
    const reh = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
    });
    if (!reh) throw new NotFoundException('Rehearsal not found');
    await this.assertUserHasProjectAccess(userId, reh.projectId, true);

    const inputs = (dto.participants ?? []).map((p) => ({
      email: normEmail(p.email),
      status: p.status,
      roles: p.roles ?? null,
    }));
    const filtered = inputs.filter((p) => p.email);
    const uniqByEmail = new Map(filtered.map((p) => [p.email, p]));

    await this.prisma.rehearsalParticipant.deleteMany({
      where: { rehearsalId },
    });

    if (uniqByEmail.size > 0) {
      await this.prisma.rehearsalParticipant.createMany({
        data: Array.from(uniqByEmail.values()).map((p) => ({
          rehearsalId,
          email: p.email,
          status: p.status as any,
          roles: p.roles,
        })),
      });
    }

    return this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      include: { participants: true },
    });
  }

  async plan(userId: string, rehearsalId: string) {
    const reh = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      include: {
        participants: true,
        project: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!reh) throw new NotFoundException('Rehearsal not found');
    await this.assertUserHasProjectAccess(userId, reh.projectId, false);

    // Важно: планирование должно опираться на календарь занятости в профиле (availabilityCalendar),
    // а не на "явку по вызову" (attendance) из participants.
    // Attendance используем только как доп. информацию (например lateTime для сдвига доступности),
    // но не как критерий готовности шага.
    const attendanceByEmail = new Map(
      (reh.participants ?? [])
        .map((p) => [normEmail(p.email), p] as const)
        .filter((x) => x[0]),
    );

    // Время доступности участника: present -> с начала, late -> с указанного времени (если распарсили HH:MM), иначе с начала.
    const rehearsalStart = dayjs(reh.startsAt);
    const rehearsalStartMin =
      rehearsalStart.hour() * 60 + rehearsalStart.minute();
    const rehearsalDurationMin = reh.durationMin ?? 120;
    const rehearsalEndMin = rehearsalStartMin + rehearsalDurationMin;
    const availableFromByEmail = new Map<string, number>();
    for (const [email, p] of attendanceByEmail.entries()) {
      if (!email) continue;
      if (p?.status !== 'late') continue;
      const parsed = extractTimeHHMM((p as any)?.lateTime);
      if (!parsed) continue;
      const mins = parsed.hh * 60 + parsed.mm;
      availableFromByEmail.set(email, Math.max(rehearsalStartMin, mins));
    }

    const selectedPlaybookIds = parseStringArrayJson(
      (reh as any)?.selectedPlaybookIds,
    );
    const selectedScenes = parseSelectedScenesJson((reh as any)?.selectedScenes);
    const allowedScenesByPlaybookId = new Map<string, Set<number>>();
    for (const x of selectedScenes) {
      const set = allowedScenesByPlaybookId.get(x.playbookId) ?? new Set<number>();
      set.add(x.sceneId);
      allowedScenesByPlaybookId.set(x.playbookId, set);
    }
    const allowedPlaybookIdsFromScenes = new Set<string>(
      selectedScenes.map((x) => x.playbookId),
    );
    const effectivePlaybookIds =
      selectedPlaybookIds.length > 0
        ? selectedPlaybookIds
        : selectedScenes.length > 0
          ? Array.from(allowedPlaybookIdsFromScenes)
          : [];

    if (selectedScenes.length === 0) {
      return {
        rehearsal: {
          id: reh.id,
          title: reh.title,
          startsAt: reh.startsAt,
          project: reh.project,
        },
        selectionRequired: true,
        availableEmails: [] as string[],
        items: [] as any[],
        timeline: {
          rehearsalStartTime: minutesToHHMM(rehearsalStartMin),
          rehearsalEndTime: minutesToHHMM(rehearsalEndMin),
          durationMin: rehearsalDurationMin,
          scheduledMin: 0,
          scenes: [] as any[],
        },
      };
    }
    const playbooks = await this.prisma.playbook.findMany({
      where: {
        projectId: reh.projectId,
        deletedAt: null,
        ...(effectivePlaybookIds.length ? { id: { in: effectivePlaybookIds } } : {}),
      },
      select: { id: true, name: true, sceneRoles: true },
    });

    const sceneRows = await this.prisma.scene.findMany({ where: { playbookId: { in: playbooks.map((s) => s.id) },
        deletedAt: null,
      },
      select: {
        playbookId: true,
        sourceId: true,
        title: true,
        markdown: true,
        playMarkdown: true,
        durationMin: true,
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

    // 1) Собираем все роли, которые реально нужны в выбранных шагах.
    const requiredRoleKeysSet = new Set<string>();
    for (const playbook of playbooks) {
      const scenes = scenesByPlaybookId.get(playbook.id) ?? [];
      for (const scene of scenes) {
        const allowed = allowedScenesByPlaybookId.get(playbook.id);
        if (
          allowed &&
          typeof scene.sourceId === 'number' &&
          !allowed.has(scene.sourceId)
        )
          continue;
        if (allowed && typeof scene.sourceId !== 'number') continue;
        const roles = getRoleTokensForScene(playbook as any, scene as any);
        roles
          .map((r) => normalizeRoleKey(r))
          .filter(Boolean)
          .forEach((k) => requiredRoleKeysSet.add(k));
      }
    }

    const assignmentsByKey = await this.roles.resolveAssignmentsByRoleKeys(
      reh.projectId,
      Array.from(requiredRoleKeysSet),
    );

    const getAssignedEmailsForRole = (roleRaw: string): string[] => {
      const roleKey = normalizeRoleKey(roleRaw);
      if (!roleKey) return [];
      const fromRoles = assignmentsByKey.get(roleKey) ?? [];
      return uniq(
        (fromRoles ?? [])
          .map((x) => String(x ?? '').trim())
          .filter((x) => x && looksLikeEmail(x))
          .map((x) => normEmail(x)),
      );
    };

    // 2) Собираем нужные email-ы для доступности.
    const neededEmails = new Set<string>();
    for (const playbook of playbooks) {
      const scenes = scenesByPlaybookId.get(playbook.id) ?? [];
      for (const scene of scenes) {
        const allowed = allowedScenesByPlaybookId.get(playbook.id);
        if (
          allowed &&
          typeof scene.sourceId === 'number' &&
          !allowed.has(scene.sourceId)
        )
          continue;
        if (allowed && typeof scene.sourceId !== 'number') continue;
        const roles = getRoleTokensForScene(playbook as any, scene as any);
        for (const role of roles) {
          getAssignedEmailsForRole(role).forEach((e) =>
            neededEmails.add(normEmail(e)),
          );
        }
      }
    }

    const neededEmailList = Array.from(neededEmails);
    const profiles =
      neededEmailList.length > 0
        ? await this.prisma.userProfile.findMany({
            where: { email: { in: neededEmailList } },
            select: { email: true, availabilityCalendar: true },
          })
        : [];
    const availabilityByEmail = new Map<string, AvailabilityCalendar>(
      profiles.map((profile) => [
        normEmail(profile.email),
        parseAvailabilityCalendar(profile.availabilityCalendar),
      ]),
    );
    const rehearsalDateKey = getDateKey(reh.startsAt);

    const availabilityStatusByEmail = new Map<
      string,
      'present' | 'absent' | 'unknown'
    >();
    for (const email of neededEmailList) {
      const calendar = availabilityByEmail.get(email);
      const st = calendar?.[rehearsalDateKey];
      availabilityStatusByEmail.set(
        email,
        st === 'present' || st === 'absent' ? st : 'unknown',
      );
    }

    const items: Array<{
      playbookId: string;
      playbookName: string;
      sceneId: number | null;
      sceneTitle: string;
      requiredRoles: string[];
      missing: string[];
      ready: boolean;
      availableFromMin: number;
      availableFromTime: string;
      lateConstraints: Array<{
        role: string;
        email: string;
        availableFromTime: string;
      }>;
      durationMin: number | null;
    }> = [];

    for (const playbook of playbooks) {
      const scenes = scenesByPlaybookId.get(playbook.id) ?? [];
      for (const scene of scenes) {
        const allowed = allowedScenesByPlaybookId.get(playbook.id);
        if (
          allowed &&
          typeof scene.sourceId === 'number' &&
          !allowed.has(scene.sourceId)
        )
          continue;
        if (allowed && typeof scene.sourceId !== 'number') continue;
        const roles = getRoleTokensForScene(playbook as any, scene as any);
        const rawDuration =
          typeof scene.durationMin === 'number' ? scene.durationMin : null;
        const durationMin =
          rawDuration != null && Number.isFinite(rawDuration) && rawDuration > 0
            ? Math.max(1, Math.min(480, Math.trunc(rawDuration)))
            : null;

        const missing: string[] = [];
        let availableFromMin = rehearsalStartMin;
        const lateConstraints: Array<{
          role: string;
          email: string;
          availableFromTime: string;
        }> = [];
        for (const role of roles) {
          const assignedList = getAssignedEmailsForRole(role);
          if (assignedList.length === 0) {
            missing.push(`${role}: не назначено`);
            continue;
          }
          for (const assigned of assignedList) {
            const email = normEmail(assigned);
            const availability =
              availabilityStatusByEmail.get(email) ?? 'unknown';
            if (availability === 'absent') {
              missing.push(`${role}: занят (${email})`);
            } else if (availability !== 'present') {
              missing.push(`${role}: не отметил присутствие (${email})`);
            }

            const fromMin =
              availableFromByEmail.get(email) ?? rehearsalStartMin;
            if (fromMin > availableFromMin) availableFromMin = fromMin;
            if (fromMin > rehearsalStartMin) {
              lateConstraints.push({
                role,
                email,
                availableFromTime: minutesToHHMM(fromMin),
              });
            }
          }
        }

        items.push({
          playbookId: playbook.id,
          playbookName: playbook.name,
          sceneId: typeof scene.sourceId === 'number' ? scene.sourceId : null,
          sceneTitle:
            (scene.title ?? '').trim() ||
            `Scene ${String(scene.sourceId ?? '')}`.trim(),
          requiredRoles: roles,
          missing,
          ready: missing.length === 0,
          availableFromMin,
          availableFromTime: minutesToHHMM(availableFromMin),
          lateConstraints,
          durationMin,
        });
      }
    }

    items.sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? -1 : 1;
      // Для готовых сцен: раньше доступны -> выше
      if (a.ready && b.ready && a.availableFromMin !== b.availableFromMin) {
        return a.availableFromMin - b.availableFromMin;
      }
      if (a.missing.length !== b.missing.length)
        return a.missing.length - b.missing.length;
      return `${a.playbookName} ${a.sceneTitle}`.localeCompare(
        `${b.playbookName} ${b.sceneTitle}`,
        'ru',
      );
    });

    // Таймлайн: берём только готовые шаги с заданной длительностью, сортируем по доступности и приоритету канбана.
    const readyForTimeline = items
      .filter((x) => x.ready && x.durationMin != null && x.durationMin > 0)
      .slice()
      .sort((a, b) => {
        if (a.availableFromMin !== b.availableFromMin)
          return a.availableFromMin - b.availableFromMin;
        return `${a.playbookName} ${a.sceneTitle}`.localeCompare(
          `${b.playbookName} ${b.sceneTitle}`,
          'ru',
        );
      });

    let cursorMin = rehearsalStartMin;
    const timeline: Array<{
      playbookId: string;
      playbookName: string;
      sceneId: number | null;
      sceneTitle: string;
      startTime: string;
      endTime: string;
      startMin: number;
      endMin: number;
      durationMin: number;
      availableFromTime: string;
    }> = [];

    for (const x of readyForTimeline) {
      const startMin = Math.max(cursorMin, x.availableFromMin);
      const endMin = startMin + (x.durationMin ?? 0);
      if (endMin > rehearsalEndMin) break;
      timeline.push({
        playbookId: x.playbookId,
        playbookName: x.playbookName,
        sceneId: x.sceneId,
        sceneTitle: x.sceneTitle,
        startTime: minutesToHHMM(startMin),
        endTime: minutesToHHMM(endMin),
        startMin,
        endMin,
        durationMin: x.durationMin ?? 0,
        availableFromTime: x.availableFromTime,
      });
      cursorMin = endMin;
    }

    return {
      rehearsal: {
        id: reh.id,
        title: reh.title,
        startsAt: reh.startsAt,
        project: reh.project,
      },
      availableEmails: neededEmailList.filter(
        (e) => (availabilityStatusByEmail.get(e) ?? 'unknown') === 'present',
      ),
      items,
      timeline: {
        rehearsalStartTime: minutesToHHMM(rehearsalStartMin),
        rehearsalEndTime: minutesToHHMM(rehearsalEndMin),
        durationMin: rehearsalDurationMin,
        scheduledMin: Math.max(0, cursorMin - rehearsalStartMin),
        scenes: timeline,
      },
    };
  }

  /**
   * Запросить публикацию репетиции в Telegram (внешний bot-сервис отправит сообщение).
   * Возвращает { ok, published?: rehearsal }.
   */
  async publish(userId: string, rehearsalId: string) {
    const reh = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      include: { project: { select: { id: true, slug: true, name: true } } },
    });
    if (!reh) throw new NotFoundException('Rehearsal not found');
    await this.assertUserHasProjectAccess(userId, reh.projectId, true);

    // NOTE: even if Telegram IDs exist, the message might have been deleted in Telegram.
    // We still call bot-service: it will try to edit existing message, and if it's gone
    // it will send a new one and overwrite Telegram IDs via markTelegramPublished.

    // Перед публикацией формируем "опрос" (participants) только из тех,
    // кто (1) нужен по выбранным сценам, и (2) в профиле отметил присутствие (availabilityCalendar: present) на дату репетиции.
    // Те, кто отметил absent или не отметил ничего — в опрос не попадают.
    const rehearsalDateKey = getDateKey(reh.startsAt);

    const selectedPlaybookIds = parseStringArrayJson(
      (reh as any)?.selectedPlaybookIds,
    );
    const selectedScenes = parseSelectedScenesJson((reh as any)?.selectedScenes);
    const allowedScenesByPlaybookId = new Map<string, Set<number>>();
    for (const x of selectedScenes) {
      const set = allowedScenesByPlaybookId.get(x.playbookId) ?? new Set<number>();
      set.add(x.sceneId);
      allowedScenesByPlaybookId.set(x.playbookId, set);
    }
    const allowedPlaybookIdsFromScenes = new Set<string>(
      selectedScenes.map((x) => x.playbookId),
    );
    const effectivePlaybookIds =
      selectedPlaybookIds.length > 0
        ? selectedPlaybookIds
        : selectedScenes.length > 0
          ? Array.from(allowedPlaybookIdsFromScenes)
          : [];
    const playbooks = await this.prisma.playbook.findMany({
      where: {
        projectId: reh.projectId,
        deletedAt: null,
        ...(effectivePlaybookIds.length ? { id: { in: effectivePlaybookIds } } : {}),
      },
      select: { id: true, name: true, sceneRoles: true },
    });

    const sceneRows2 = await this.prisma.scene.findMany({ where: { playbookId: { in: playbooks.map((s) => s.id) },
        deletedAt: null,
      },
      select: {
        playbookId: true,
        sourceId: true,
        title: true,
        markdown: true,
        playMarkdown: true,
        order: true,
      },
      orderBy: [{ playbookId: 'asc' }, { order: 'asc' }],
    });
    const scenesByPlaybookId2 = new Map<string, typeof sceneRows2>();
    for (const st of sceneRows2) {
      const list = scenesByPlaybookId2.get(st.playbookId) ?? [];
      list.push(st);
      scenesByPlaybookId2.set(st.playbookId, list);
    }
    if (effectivePlaybookIds.length && playbooks.length === 0) {
      throw new BadRequestException('Выбранные сцены не найдены');
    }
    if (playbooks.length === 0) {
      throw new BadRequestException(
        'Перед публикацией выберите сцены для репетиции',
      );
    }
    if (selectedScenes.length === 0) {
      throw new BadRequestException(
        'Перед публикацией выберите сцены (шаги) для репетиции',
      );
    }

    // Нужные участники для публикации берём из назначений ролей (Role assignments).
    const requiredRoleKeysSet = new Set<string>();
    for (const playbook of playbooks) {
      const scenes = scenesByPlaybookId2.get(playbook.id) ?? [];
      for (const scene of scenes) {
        const allowed = allowedScenesByPlaybookId.get(playbook.id);
        if (
          allowed &&
          typeof scene.sourceId === 'number' &&
          !allowed.has(scene.sourceId)
        )
          continue;
        if (allowed && typeof scene.sourceId !== 'number') continue;
        const roles = getRoleTokensForScene(playbook as any, scene as any);
        roles
          .map((r) => normalizeRoleKey(r))
          .filter(Boolean)
          .forEach((k) => requiredRoleKeysSet.add(k));
      }
    }

    const assignmentsByKey = await this.roles.resolveAssignmentsByRoleKeys(
      reh.projectId,
      Array.from(requiredRoleKeysSet),
    );

    const getAssignedEmailsForRole = (roleRaw: string): string[] => {
      const roleKey = normalizeRoleKey(roleRaw);
      if (!roleKey) return [];
      const fromRoles = assignmentsByKey.get(roleKey) ?? [];
      return uniq(
        (fromRoles ?? [])
          .map((x) => String(x ?? '').trim())
          .filter((x) => x && looksLikeEmail(x))
          .map((x) => normEmail(x)),
      );
    };

    const neededEmails = new Set<string>();
    const missingRoles = new Set<string>();
    for (const playbook of playbooks) {
      const scenes = scenesByPlaybookId2.get(playbook.id) ?? [];
      for (const scene of scenes) {
        const allowed = allowedScenesByPlaybookId.get(playbook.id);
        if (
          allowed &&
          typeof scene.sourceId === 'number' &&
          !allowed.has(scene.sourceId)
        )
          continue;
        if (allowed && typeof scene.sourceId !== 'number') continue;
        const roles = getRoleTokensForScene(playbook as any, scene as any);
        for (const role of roles) {
          const emails = getAssignedEmailsForRole(role);
          if (emails.length === 0) missingRoles.add(role);
          emails.forEach((e) => neededEmails.add(normEmail(e)));
        }
      }
    }

    if (missingRoles.size > 0) {
      const list = Array.from(missingRoles).slice(0, 8).join(', ');
      throw new BadRequestException(
        `Нельзя опубликовать репетицию: не назначены роли (${list}${missingRoles.size > 8 ? '…' : ''}). Зайди в раздел «Роли» и назначь актёров.`,
      );
    }

    const neededEmailList = Array.from(neededEmails);
    const profiles =
      neededEmailList.length > 0
        ? await this.prisma.userProfile.findMany({
            where: {
              email: {
                in: neededEmailList,
              },
            },
            select: {
              email: true,
              availabilityCalendar: true,
              displayName: true,
              firstName: true,
              lastName: true,
              telegramId: true,
            },
          })
        : [];
    const present = profiles
      .map((p) => {
        const email = normEmail(p.email);
        const calendar = parseAvailabilityCalendar(p.availabilityCalendar);
        const st = calendar?.[rehearsalDateKey];
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
          userName,
          telegramId: p.telegramId ? String(p.telegramId).trim() || null : null,
        };
      })
      .filter(Boolean) as Array<{
      email: string;
      userName: string | null;
      telegramId: string | null;
    }>;

    if (present.length === 0) {
      throw new BadRequestException(
        `Нельзя опубликовать репетицию: среди нужных по сценам никто не отметил присутствие в профиле на ${rehearsalDateKey}`,
      );
    }

    await this.prisma.rehearsalParticipant.deleteMany({
      where: { rehearsalId },
    });
    await this.prisma.rehearsalParticipant.createMany({
      data: present.map((p) => ({
        rehearsalId,
        email: p.email,
        status: 'unknown' as any,
        userName: p.userName,
        telegramId: p.telegramId,
      })),
    });

    const botUrl =
      this.config.get<string>('BOT_INTERNAL_URL') || 'http://bot:3001';
    const secret = this.config.get<string>('INTERNAL_API_SECRET');
    if (!secret) {
      throw new BadRequestException('INTERNAL_API_SECRET is not configured');
    }

    const pref = await this.prisma.projectTelegramBotPreference.findUnique({
      where: { projectId_userId: { projectId: reh.projectId, userId } },
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
      throw new BadRequestException(
        'No connected Telegram bot. Connect a bot and select it in Project settings.',
      );
    }

    try {
      const url = `${botUrl.replace(/\/$/, '')}/internal/publish-rehearsal`;
      const payload = { rehearsalId, botIntegrationId };
      const headers = { 'X-Internal-Secret': secret };

      const delaysMs = [200, 800, 2000];
      let lastErr: any = null;
      for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
        try {
          await axios.post(url, payload, { headers });
          lastErr = null;
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
      if (lastErr) throw lastErr;
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

    // Бот сам пометит published через /bot/rehearsals/:id/published.
    return { ok: true };
  }

  /** Сохранить данные опубликованного сообщения Telegram в репетиции */
  async markTelegramPublished(
    userId: string,
    rehearsalId: string,
    dto: { chatId: string; messageId: string; threadId?: string },
  ) {
    const reh = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
    });
    if (!reh) throw new NotFoundException('Rehearsal not found');
    await this.assertUserHasProjectAccess(userId, reh.projectId, true);

    return this.prisma.rehearsal.update({
      where: { id: rehearsalId },
      data: {
        telegramChatId: String(dto.chatId ?? '').trim() || null,
        telegramMessageId: String(dto.messageId ?? '').trim() || null,
        telegramThreadId:
          dto.threadId != null
            ? String(dto.threadId).trim() || null
            : undefined,
        publishedAt: new Date(),
      },
      include: { participants: true },
    });
  }

  /**
   * Upsert явки участника из Telegram (по telegramId).
   * Важно: это "attendance" для репетиции, не calendar availability в профиле.
   */
  async upsertParticipantStatusFromBot(
    rehearsalId: string,
    dto: {
      telegramId: string;
      status: 'present' | 'absent' | 'late' | 'unknown';
      userName?: string;
      lateTime?: string;
    },
  ) {
    const reh = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
    });
    if (!reh) throw new NotFoundException('Rehearsal not found');

    const telegramId = String(dto.telegramId ?? '').trim();
    if (!telegramId) throw new BadRequestException('telegramId is required');

    const profile = await this.prisma.userProfile.findUnique({
      where: { telegramId },
      select: {
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!profile?.email) {
      throw new NotFoundException('Profile not found for telegramId');
    }

    const email = normEmail(profile.email);
    const nameFromProfile =
      String(profile.displayName ?? '').trim() ||
      [profile.firstName, profile.lastName]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean)
        .join(' ') ||
      null;
    const userName =
      dto.userName != null
        ? String(dto.userName).trim() || null
        : nameFromProfile;

    const status = dto.status;
    if (!['present', 'absent', 'late', 'unknown'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    await this.prisma.rehearsalParticipant.upsert({
      where: { rehearsalId_email: { rehearsalId, email } },
      update: {
        status: status as any,
        telegramId,
        userName,
        lateTime:
          dto.lateTime != null
            ? String(dto.lateTime).trim() || null
            : undefined,
        respondedAt: new Date(),
      },
      create: {
        rehearsalId,
        email,
        status: status as any,
        telegramId,
        userName,
        lateTime:
          dto.lateTime != null ? String(dto.lateTime).trim() || null : null,
        respondedAt: new Date(),
      },
    });

    return this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      include: {
        participants: true,
        project: { select: { id: true, slug: true, name: true } },
      },
    });
  }
}
