import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

function clean(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
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
      },
      create: {
        email: normalized,
        displayName: clean(dto.displayName),
        firstName: clean(dto.firstName),
        lastName: clean(dto.lastName),
        telegramUsername: clean(dto.telegramUsername),
        telegramId: clean(dto.telegramId),
        avatarUrl: clean(dto.avatarUrl),
      },
    });
  }
}

