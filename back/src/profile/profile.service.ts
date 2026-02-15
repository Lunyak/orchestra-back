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

function sanitizeCharacters(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (value === null) return undefined;
  
  // Если это уже массив
  if (Array.isArray(value)) {
    return value
      .map(item => typeof item === 'string' ? item.trim() : String(item))
      .filter(item => item.length > 0);
  }
  
  // Если это строка, пытаемся распарсить как JSON
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    
    // Если строка начинается с [, пытаемся распарсить как JSON
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map(item => typeof item === 'string' ? item.trim() : String(item))
            .filter(item => item.length > 0);
        }
      } catch (e) {
        // Если не получилось распарсить, возвращаем как одноэлементный массив
        return [trimmed];
      }
    }
    
    // Иначе это одна строка
    return [trimmed];
  }
  
  return undefined;
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

  async getByTelegramId(telegramId: string) {
    return this.prisma.userProfile.findUnique({
      where: { telegramId },
    });
  }

  async createByTelegramId(telegramId: string, dto: UpdateProfileDto) {
    // Используем email по умолчанию если не указан
    const email = dto.email || `telegram_${telegramId}@temp.local`;
    return this.prisma.userProfile.create({
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
        characters: sanitizeCharacters(dto.characters),
        phone: clean(dto.phone),
        birthday: clean(dto.birthday),
        availabilityCalendar: sanitizeAvailabilityCalendar(dto.availabilityCalendar),
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

    return this.prisma.userProfile.update({
      where: { telegramId },
      data: {
        email: dto.email ? dto.email.trim().toLowerCase() : undefined,
        displayName: clean(dto.displayName),
        firstName: clean(dto.firstName),
        lastName: clean(dto.lastName),
        telegramUsername: clean(dto.telegramUsername),
        avatarUrl: clean(dto.avatarUrl),
        sex: clean(dto.sex),
        role: clean(dto.role),
        characters: dto.characters !== undefined ? dto.characters : undefined,
        phone: clean(dto.phone),
        birthday: clean(dto.birthday),
        availabilityCalendar: sanitizeAvailabilityCalendar(dto.availabilityCalendar),
      },
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
        characters: dto.characters !== undefined ? dto.characters : undefined,
        phone: clean(dto.phone),
        birthday: clean(dto.birthday),
      },
    });
  }
}
