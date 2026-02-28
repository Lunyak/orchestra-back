import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../files/file-storage.service';
import { LocalFileStorageService } from '../files/local-file-storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

function clean(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

function cleanOptional(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  return clean(v);
}

function sanitizeAvailabilityCalendar(
  value: unknown,
): Record<string, 'present' | 'absent'> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;

  const out: Record<string, 'present' | 'absent'> = {};
  for (const [date, rawStatus] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (rawStatus === 'present' || rawStatus === 'absent') {
      out[date] = rawStatus;
    }
  }
  return out;
}

type AvailabilityTimeRange = { from: string; to: string };

function toMinutesHHMM(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function minutesToHHMM(min: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.floor(min)));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function sanitizeAvailabilityTimeRanges(
  value: unknown,
): Record<string, AvailabilityTimeRange[]> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;

  const out: Record<string, AvailabilityTimeRange[]> = {};
  for (const [date, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!Array.isArray(raw)) continue;
    const ranges: Array<{ fromMin: number; toMin: number }> = [];
    for (const item of raw.slice(0, 20)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const fromMin = toMinutesHHMM((item as any).from);
      const toMin = toMinutesHHMM((item as any).to);
      if (fromMin == null || toMin == null) continue;
      if (fromMin >= toMin) continue;
      // allow 00:00..24:00 upper bound by clamping
      const a = Math.max(0, Math.min(24 * 60, fromMin));
      const b = Math.max(0, Math.min(24 * 60, toMin));
      if (a >= b) continue;
      ranges.push({ fromMin: a, toMin: b });
    }
    if (ranges.length === 0) continue;
    // sort + merge overlaps for stable storage
    ranges.sort((a, b) => a.fromMin - b.fromMin || a.toMin - b.toMin);
    const merged: Array<{ fromMin: number; toMin: number }> = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (!last || r.fromMin > last.toMin) merged.push({ ...r });
      else last.toMin = Math.max(last.toMin, r.toMin);
    }
    out[date] = merged.map((r) => ({
      from: minutesToHHMM(r.fromMin),
      to: minutesToHHMM(r.toMin),
    }));
  }
  return out;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: FileStorageService,
    private readonly localStorage: LocalFileStorageService,
  ) {}

  private useLocalStorage(): boolean {
    return this.config.get<string>('STORAGE_TYPE') === 'local';
  }

  private profileBucketId(email: string): string {
    const norm = String(email ?? '').trim().toLowerCase();
    const h = createHash('sha1').update(norm).digest('hex').slice(0, 16);
    return `profile-${h}`;
  }

  async uploadAvatarByEmail(email: string, file: any) {
    const norm = String(email ?? '').trim().toLowerCase();
    if (!norm) throw new Error('email is required');
    const mimetype = String(file?.mimetype ?? '');
    if (!mimetype.startsWith('image/')) {
      throw new Error('avatar must be an image');
    }
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    if (!allowed.has(mimetype)) {
      throw new Error('unsupported image type');
    }
    if (!file?.buffer) throw new Error('file buffer missing');

    const storage = this.useLocalStorage() ? this.localStorage : this.storage;
    const ext =
      mimetype === 'image/png'
        ? '.png'
        : mimetype === 'image/webp'
          ? '.webp'
          : mimetype === 'image/gif'
            ? '.gif'
            : '.jpg';

    const result = await storage.uploadObject({
      projectId: this.profileBucketId(norm),
      type: 'image',
      fileName: `avatar${ext}`,
      buffer: file.buffer,
      contentType: mimetype,
    });

    return await this.prisma.userProfile.upsert({
      where: { email: norm },
      update: { avatarUrl: result.url },
      create: { email: norm, avatarUrl: result.url },
    });
  }

  async getManyByEmails(emails: string[]) {
    const normalized = Array.from(
      new Set(
        (Array.isArray(emails) ? emails : [])
          .map((e) =>
            String(e ?? '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    if (normalized.length === 0) return [];

    return await this.prisma.userProfile.findMany({
      where: { email: { in: normalized } },
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
  }

  async getOrCreateByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    return await this.prisma.userProfile.upsert({
      where: { email: normalized },
      update: {},
      create: { email: normalized },
    });
  }

  async getByTelegramId(telegramId: string) {
    return await this.prisma.userProfile.findUnique({
      where: { telegramId },
    });
  }

  async createByTelegramId(telegramId: string, dto: UpdateProfileDto) {
    // Используем email по умолчанию если не указан
    const email = dto.email || `telegram_${telegramId}@temp.local`;
    return await this.prisma.userProfile.create({
      data: {
        email: email.trim().toLowerCase(),
        telegramId,
        displayName: clean(dto.displayName),
        firstName: clean(dto.firstName),
        lastName: clean(dto.lastName),
        telegramUsername: clean(dto.telegramUsername),
        avatarUrl: clean(dto.avatarUrl),
        sex: clean(dto.sex),
        role: clean(dto.role),
        phone: clean(dto.phone),
        birthday: clean(dto.birthday),
        availabilityCalendar: sanitizeAvailabilityCalendar(
          dto.availabilityCalendar,
        ),
        availabilityTimeRanges: sanitizeAvailabilityTimeRanges(dto.availabilityTimeRanges),
      },
    });
  }

  async updateByTelegramId(telegramId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.userProfile.findUnique({
      where: { telegramId },
    });

    if (!existing) {
      // Если профиль не существует, создаем его
      return this.createByTelegramId(telegramId, dto);
    }

    return await this.prisma.userProfile.update({
      where: { telegramId },
      data: {
        email: dto.email ? dto.email.trim().toLowerCase() : undefined,
        displayName: cleanOptional(dto.displayName),
        firstName: cleanOptional(dto.firstName),
        lastName: cleanOptional(dto.lastName),
        telegramUsername: cleanOptional(dto.telegramUsername),
        avatarUrl: cleanOptional(dto.avatarUrl),
        sex: cleanOptional(dto.sex),
        role: cleanOptional(dto.role),
        phone: cleanOptional(dto.phone),
        birthday: cleanOptional(dto.birthday),
        availabilityCalendar: sanitizeAvailabilityCalendar(
          dto.availabilityCalendar,
        ),
        availabilityTimeRanges: sanitizeAvailabilityTimeRanges(dto.availabilityTimeRanges),
      },
    });
  }

  async updateByEmail(email: string, dto: UpdateProfileDto) {
    const normalized = email.trim().toLowerCase();
    return await this.prisma.userProfile.upsert({
      where: { email: normalized },
      update: {
        displayName: cleanOptional(dto.displayName),
        firstName: cleanOptional(dto.firstName),
        lastName: cleanOptional(dto.lastName),
        telegramUsername: cleanOptional(dto.telegramUsername),
        telegramId:
          dto.telegramId !== undefined ? clean(dto.telegramId) : undefined,
        avatarUrl: cleanOptional(dto.avatarUrl),
        availabilityCalendar: sanitizeAvailabilityCalendar(
          dto.availabilityCalendar,
        ),
        availabilityTimeRanges: sanitizeAvailabilityTimeRanges(dto.availabilityTimeRanges),
        sex: cleanOptional(dto.sex),
        role: cleanOptional(dto.role),
        phone: cleanOptional(dto.phone),
        birthday: cleanOptional(dto.birthday),
      },
      create: {
        email: normalized,
        displayName: clean(dto.displayName),
        firstName: clean(dto.firstName),
        lastName: clean(dto.lastName),
        telegramUsername: clean(dto.telegramUsername),
        telegramId: clean(dto.telegramId),
        avatarUrl: clean(dto.avatarUrl),
        availabilityCalendar: sanitizeAvailabilityCalendar(
          dto.availabilityCalendar,
        ),
        availabilityTimeRanges: sanitizeAvailabilityTimeRanges(dto.availabilityTimeRanges),
        sex: clean(dto.sex),
        role: clean(dto.role),
        phone: clean(dto.phone),
        birthday: clean(dto.birthday),
      },
    });
  }
}
