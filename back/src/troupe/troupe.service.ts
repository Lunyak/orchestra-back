import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function normalizeEmail(v: unknown): string {
  const email = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!email) throw new BadRequestException('email is required');
  return email;
}

@Injectable()
export class TroupeService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateMyTroupe(userId: string) {
    const existing = await this.prisma.troupe.findUnique({
      where: { ownerUserId: userId },
    });
    if (existing) return existing;
    return await this.prisma.troupe.create({
      data: { ownerUserId: userId, title: 'Моя труппа' },
    });
  }

  async getMyTroupeWithMembers(userId: string) {
    const troupe = await this.getOrCreateMyTroupe(userId);
    const members = await this.prisma.troupeMember.findMany({
      where: { troupeId: troupe.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, troupeId: true, email: true, createdAt: true },
    });

    const emails = members.map((m) => m.email.trim().toLowerCase()).filter(Boolean);
    const profiles = emails.length
      ? await this.prisma.userProfile.findMany({
          where: { email: { in: emails } },
          select: {
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
            telegramId: true,
            characters: true,
            availabilityCalendar: true,
            availabilityTimeRanges: true,
          },
        })
      : [];

    const profileByEmail = new Map(profiles.map((p) => [p.email, p]));

    return {
      troupe: {
        id: troupe.id,
        title: troupe.title,
        createdAt: troupe.createdAt,
        updatedAt: troupe.updatedAt,
      },
      members: members.map((m) => ({
        ...m,
        profile: profileByEmail.get(m.email.trim().toLowerCase()) ?? null,
      })),
    };
  }

  async addMember(userId: string, rawEmail: unknown) {
    const troupe = await this.getOrCreateMyTroupe(userId);
    const email = normalizeEmail(rawEmail);

    try {
      const created = await this.prisma.troupeMember.create({
        data: { troupeId: troupe.id, email },
        select: { id: true, troupeId: true, email: true, createdAt: true },
      });

      const profile = await this.prisma.userProfile.findUnique({
        where: { email },
        select: {
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
          telegramId: true,
          characters: true,
          availabilityCalendar: true,
          availabilityTimeRanges: true,
        },
      });

      return { ...created, profile: profile ?? null };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Участник с таким email уже есть в труппе');
      }
      throw error;
    }
  }

  async removeMember(userId: string, memberId: string) {
    const troupe = await this.getOrCreateMyTroupe(userId);
    const id = String(memberId ?? '').trim();
    if (!id) throw new BadRequestException('memberId is required');

    const res = await this.prisma.troupeMember.deleteMany({
      where: { id, troupeId: troupe.id },
    });
    if (res.count === 0) throw new NotFoundException('Member not found');
    return { ok: true };
  }
}

