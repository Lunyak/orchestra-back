import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RehearsalPlanRequestDto } from './dto/rehearsal-plan.dto';
import { BotProfilesUpsertDto } from './dto/bot-profiles.dto';

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
    const m1 = line.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.\-]{1,40})\s*[:—-]\s+\S/);
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

type RawStepLike = {
  id?: number;
  title?: string;
  markdown?: string;
  playMarkdown?: string;
  kanbanStatus?: string;
  kanbanOrder?: number;
  cast?: Record<string, string>;
};

@Injectable()
export class BotService {
  constructor(private readonly prisma: PrismaService) {}

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
          .map((e) => String(e ?? '').trim().toLowerCase())
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
    if (Array.isArray(dto.presentRoles)) presentRolesRaw.push(...dto.presentRoles);
    if (Array.isArray(dto.presentPeople)) {
      dto.presentPeople.forEach((p) => {
        if (Array.isArray(p.roles)) presentRolesRaw.push(...p.roles);
      });
    }

    const presentNorm = new Set(presentRolesRaw.map(normalizeRole).filter(Boolean));
    if (presentNorm.size === 0) {
      throw new BadRequestException('presentRoles or presentPeople.roles must be provided');
    }

    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        scenes: {
          where: { deletedAt: null },
          select: { id: true, name: true, rawJson: true, updatedAt: true },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const items: Array<{
      projectSlug: string;
      sceneId: string;
      sceneName: string;
      stepId: number | null;
      stepTitle: string;
      requiredRoles: string[];
      missingRoles: string[];
      ready: boolean;
      kanbanStatus?: string;
      kanbanOrder?: number;
    }> = [];

    for (const scene of project.scenes) {
      const raw = scene.rawJson as any;
      const steps = Array.isArray(raw?.steps) ? (raw.steps as RawStepLike[]) : [];
      for (const step of steps) {
        const text = (step.playMarkdown ?? step.markdown ?? '') as string;
        const requiredRoles = extractRolesSmart(text);

        // Если ролей нет — такую "сцену" можно репетировать всегда (техничка/ремарки).
        if (requiredRoles.length === 0) {
          items.push({
            projectSlug: project.slug,
            sceneId: scene.id,
            sceneName: scene.name,
            stepId: typeof step.id === 'number' ? step.id : null,
            stepTitle: (step.title ?? '').trim() || `Step ${String(step.id ?? '')}`.trim(),
            requiredRoles: [],
            missingRoles: [],
            ready: true,
            kanbanStatus: step.kanbanStatus,
            kanbanOrder: step.kanbanOrder,
          });
          continue;
        }

        const roleNormToOriginal = new Map<string, string>();
        requiredRoles.forEach((r) => {
          const n = normalizeRole(r);
          if (!n) return;
          if (!roleNormToOriginal.has(n)) roleNormToOriginal.set(n, r);
        });

        const missingNorm = [...roleNormToOriginal.keys()].filter((n) => !presentNorm.has(n));
        const missingRoles = missingNorm
          .map((n) => roleNormToOriginal.get(n) ?? n)
          .sort((a, b) => a.localeCompare(b, 'ru'));

        items.push({
          projectSlug: project.slug,
          sceneId: scene.id,
          sceneName: scene.name,
          stepId: typeof step.id === 'number' ? step.id : null,
          stepTitle: (step.title ?? '').trim() || `Step ${String(step.id ?? '')}`.trim(),
          requiredRoles: requiredRoles.sort((a, b) => a.localeCompare(b, 'ru')),
          missingRoles,
          ready: missingRoles.length === 0,
          kanbanStatus: step.kanbanStatus,
          kanbanOrder: step.kanbanOrder,
        });
      }
    }

    // Сортировка: сначала доступные, потом "почти", потом остальные
    items.sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? -1 : 1;
      if (a.missingRoles.length !== b.missingRoles.length) {
        return a.missingRoles.length - b.missingRoles.length;
      }
      const aa = `${a.sceneName} ${a.stepTitle}`;
      const bb = `${b.sceneName} ${b.stepTitle}`;
      return aa.localeCompare(bb, 'ru');
    });

    return {
      project: { id: project.id, slug: project.slug, name: project.name },
      presentRoles: Array.from(presentNorm),
      items,
    };
  }
}

