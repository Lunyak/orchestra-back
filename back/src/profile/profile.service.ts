import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

function clean(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
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

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    return this.prisma.userProfile.upsert({
      where: { email: normalized },
      update: {},
      create: { email: normalized },
    });
  }

  async updateByEmail(email: string, dto: UpdateProfileDto) {
    const normalized = email.trim().toLowerCase();
    return this.prisma.userProfile.upsert({
      where: { email: normalized },
      update: {
        displayName: clean(dto.displayName),
        firstName: clean(dto.firstName),
        lastName: clean(dto.lastName),
        telegramUsername: clean(dto.telegramUsername),
        telegramId: clean(dto.telegramId),
        avatarUrl: clean(dto.avatarUrl),
        availabilityCalendar: sanitizeAvailabilityCalendar(
          dto.availabilityCalendar,
        ),
        sex: clean(dto.sex),
        role: clean(dto.role),
        characters: dto.characters !== undefined ? dto.characters : undefined,
        phone: clean(dto.phone),
        birthday: clean(dto.birthday),
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
        sex: clean(dto.sex),
        role: clean(dto.role),
        characters: dto.characters || null,
        phone: clean(dto.phone),
        birthday: clean(dto.birthday),
      },
    });
  }
}
