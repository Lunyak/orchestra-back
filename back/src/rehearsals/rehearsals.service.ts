import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRehearsalDto } from './dto/create-rehearsal.dto';
import { SetParticipantsDto } from './dto/set-participants.dto';
import { UpdateRehearsalDto } from './dto/update-rehearsal.dto';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/ru';

dayjs.extend(customParseFormat);
dayjs.locale('ru');

function normEmail(v: string): string {
  return String(v ?? '').trim().toLowerCase();
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

type RawStepLike = {
  id?: number;
  title?: string;
  markdown?: string;
  playMarkdown?: string;
  cast?: Record<string, string>;
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
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
    const m1 = line.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.\-]{1,40})\s*[:—-]\s+\S/);
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
  return uniq([...extractRolesByBrackets(text), ...extractSpeakerRolesFromLines(text)]);
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
  for (const [date, rawStatus] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (rawStatus === 'present' || rawStatus === 'absent') out[date] = rawStatus;
  }
  return out;
}

@Injectable()
export class RehearsalsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertUserHasProjectAccess(userId: string, projectId: string, write: boolean) {
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
    if (!project.members.length) throw new ForbiddenException('No access to project');
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
      },
      include: { participants: true },
    });
  }

  async setParticipants(userId: string, rehearsalId: string, dto: SetParticipantsDto) {
    const reh = await this.prisma.rehearsal.findUnique({ where: { id: rehearsalId } });
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
      include: { participants: true, project: { select: { id: true, slug: true, name: true } } },
    });
    if (!reh) throw new NotFoundException('Rehearsal not found');
    await this.assertUserHasProjectAccess(userId, reh.projectId, false);

    const presentEmails = new Set(
      reh.participants
        .filter((p) => p.status === 'present')
        .map((p) => normEmail(p.email))
        .filter(Boolean),
    );

    const scenes = await this.prisma.scene.findMany({
      where: { projectId: reh.projectId, deletedAt: null },
      select: { id: true, name: true, rawJson: true },
    });

    const castEmails = new Set<string>();
    for (const scene of scenes) {
      const raw = scene.rawJson as any;
      const steps = Array.isArray(raw?.steps) ? (raw.steps as RawStepLike[]) : [];
      for (const step of steps) {
        const cast = step.cast ?? {};
        for (const rawAssigned of Object.values(cast)) {
          const assigned = String(rawAssigned ?? '').trim();
          if (!looksLikeEmail(assigned)) continue;
          castEmails.add(normEmail(assigned));
        }
      }
    }

    const castEmailList = Array.from(castEmails);
    const profiles =
      castEmailList.length > 0
        ? await this.prisma.userProfile.findMany({
            where: { email: { in: castEmailList } },
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

    const items: Array<{
      sceneId: string;
      sceneName: string;
      stepId: number | null;
      stepTitle: string;
      requiredRoles: string[];
      missing: string[];
      ready: boolean;
    }> = [];

    for (const scene of scenes) {
      const raw = scene.rawJson as any;
      const steps = Array.isArray(raw?.steps) ? (raw.steps as RawStepLike[]) : [];
      for (const step of steps) {
        const text = (step.playMarkdown ?? step.markdown ?? '') as string;
        const roles = extractRolesSmart(text);
        const cast = step.cast ?? {};

        const missing: string[] = [];
        for (const role of roles) {
          const assigned = String(cast[role] ?? '').trim();
          if (!assigned) {
            missing.push(`${role}: не назначено`);
            continue;
          }
          if (!looksLikeEmail(assigned)) {
            missing.push(`${role}: "${assigned}" (нужен email)`);
            continue;
          }
          const email = normEmail(assigned);
          if (!presentEmails.has(email)) missing.push(`${role}: нет (${email})`);
          const calendar = availabilityByEmail.get(email);
          if (calendar?.[rehearsalDateKey] === 'absent') {
            missing.push(`${role}: занят (${email})`);
          }
        }

        items.push({
          sceneId: scene.id,
          sceneName: scene.name,
          stepId: typeof step.id === 'number' ? step.id : null,
          stepTitle: (step.title ?? '').trim() || `Step ${String(step.id ?? '')}`.trim(),
          requiredRoles: roles,
          missing,
          ready: missing.length === 0,
        });
      }
    }

    items.sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? -1 : 1;
      if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
      return `${a.sceneName} ${a.stepTitle}`.localeCompare(`${b.sceneName} ${b.stepTitle}`, 'ru');
    });

    return {
      rehearsal: { id: reh.id, title: reh.title, startsAt: reh.startsAt, project: reh.project },
      presentEmails: Array.from(presentEmails),
      items,
    };
  }
}

