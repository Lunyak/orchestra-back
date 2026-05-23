import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PremiseMemberRole,
  PremiseSlotStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddPremiseMemberDto } from './dto/add-premise-member.dto';
import { CreatePremiseDto } from './dto/create-premise.dto';
import { CreatePremiseSlotDto } from './dto/create-premise-slot.dto';
import { UpdatePremiseDto } from './dto/update-premise.dto';
import { UpdatePremiseMemberDto } from './dto/update-premise-member.dto';
import { UpdatePremiseSlotDto } from './dto/update-premise-slot.dto';

function normalizeEmail(v: unknown): string {
  const email = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!email) throw new BadRequestException('email is required');
  return email;
}

type PremiseAccess = {
  premise: {
    id: string;
    troupeId: string;
    troupe: { ownerUserId: string; title: string };
  };
  isTroupeOwner: boolean;
  member: {
    role: PremiseMemberRole;
    canBook: boolean;
  } | null;
  canView: boolean;
  canManage: boolean;
  canBook: boolean;
};

const premiseSelect = {
  id: true,
  troupeId: true,
  name: true,
  kind: true,
  address: true,
  capacity: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  troupe: { select: { ownerUserId: true, title: true } },
} as const;

const slotSelect = {
  id: true,
  premiseId: true,
  startsAt: true,
  durationMin: true,
  title: true,
  purpose: true,
  rentalNotes: true,
  contactEmail: true,
  contactName: true,
  status: true,
  createdByEmail: true,
  createdAt: true,
  updatedAt: true,
} as const;

const memberSelect = {
  id: true,
  premiseId: true,
  email: true,
  role: true,
  canBook: true,
  createdAt: true,
  updatedAt: true,
} as const;

function serializePremise(
  row: Prisma.PremiseGetPayload<{ select: typeof premiseSelect }>,
  access: Omit<PremiseAccess, 'premise'>,
) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    troupeTitle: row.troupe.title,
    canManage: access.canManage,
    canBook: access.canBook,
    myRole: access.isTroupeOwner
      ? ('troupe_owner' as const)
      : (access.member?.role ?? null),
  };
}

function serializeSlot(
  row: Prisma.PremiseSlotGetPayload<{ select: typeof slotSelect }>,
) {
  return {
    ...row,
    startsAt: row.startsAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeMember(
  row: Prisma.PremiseMemberGetPayload<{ select: typeof memberSelect }>,
) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isManagerRole(role: PremiseMemberRole): boolean {
  return role === PremiseMemberRole.owner || role === PremiseMemberRole.manager;
}

@Injectable()
export class PremisesService {
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

  private async resolveAccess(
    userId: string,
    userEmailRaw: string,
    premiseId: string,
  ): Promise<PremiseAccess> {
    const userEmail = normalizeEmail(userEmailRaw);
    const premise = await this.prisma.premise.findUnique({
      where: { id: premiseId },
      select: {
        id: true,
        troupeId: true,
        troupe: { select: { ownerUserId: true, title: true } },
      },
    });
    if (!premise) throw new NotFoundException('Premise not found');

    const isTroupeOwner = premise.troupe.ownerUserId === userId;
    const member = await this.prisma.premiseMember.findUnique({
      where: {
        premiseId_email: { premiseId, email: userEmail },
      },
      select: { role: true, canBook: true },
    });

    const canView = isTroupeOwner || member != null;
    if (!canView) {
      throw new ForbiddenException('Нет доступа к этому помещению');
    }

    const canManage =
      isTroupeOwner || (member != null && isManagerRole(member.role));
    const canBook =
      canManage ||
      (member != null &&
        member.canBook &&
        (member.role === PremiseMemberRole.tenant ||
          member.role === PremiseMemberRole.manager ||
          member.role === PremiseMemberRole.owner));

    return {
      premise,
      isTroupeOwner,
      member: member ?? null,
      canView,
      canManage,
      canBook,
    };
  }

  private assertCanManage(access: PremiseAccess) {
    if (!access.canManage) {
      throw new ForbiddenException(
        'Недостаточно прав для управления помещением',
      );
    }
  }

  private assertCanBook(access: PremiseAccess) {
    if (!access.canBook) {
      throw new ForbiddenException('Недостаточно прав для бронирования');
    }
  }

  private canEditSlot(
    access: PremiseAccess,
    userEmail: string,
    slot: { createdByEmail: string; contactEmail: string | null },
  ): boolean {
    if (access.canManage) return true;
    const email = normalizeEmail(userEmail);
    if (!access.canBook) return false;
    const createdBy = slot.createdByEmail.trim().toLowerCase();
    const contact = slot.contactEmail?.trim().toLowerCase() ?? '';
    return createdBy === email || contact === email;
  }

  private async findConflictingSlots(
    premiseId: string,
    startsAt: Date,
    durationMin: number,
    excludeSlotId?: string,
  ) {
    const newStart = startsAt.getTime();
    const newEnd = newStart + durationMin * 60 * 1000;

    const slots = await this.prisma.premiseSlot.findMany({
      where: {
        premiseId,
        status: { not: PremiseSlotStatus.cancelled },
        ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      },
      select: slotSelect,
    });

    return slots.filter((s) => {
      const start = s.startsAt.getTime();
      const end = start + s.durationMin * 60 * 1000;
      return start < newEnd && end > newStart;
    });
  }

  private parseRange(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (from && Number.isNaN(fromDate!.getTime())) {
      throw new BadRequestException('Invalid "from" date');
    }
    if (to && Number.isNaN(toDate!.getTime())) {
      throw new BadRequestException('Invalid "to" date');
    }
    return { fromDate, toDate };
  }

  async listPremises(userId: string, userEmail: string) {
    const email = normalizeEmail(userEmail);
    const ownTroupe = await this.prisma.troupe.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });

    const memberRows = await this.prisma.premiseMember.findMany({
      where: { email },
      select: { premiseId: true, role: true, canBook: true },
    });
    const memberByPremiseId = new Map(
      memberRows.map((m) => [m.premiseId, m]),
    );
    const memberPremiseIds = memberRows.map((m) => m.premiseId);

    if (!ownTroupe && memberPremiseIds.length === 0) {
      return { premises: [] };
    }

    const rows = await this.prisma.premise.findMany({
      where: {
        OR: [
          ...(ownTroupe ? [{ troupeId: ownTroupe.id }] : []),
          ...(memberPremiseIds.length
            ? [{ id: { in: memberPremiseIds } }]
            : []),
        ],
      },
      select: premiseSelect,
      orderBy: [{ name: 'asc' }],
    });

    const unique = new Map<string, (typeof rows)[number]>();
    for (const row of rows) unique.set(row.id, row);

    return {
      premises: [...unique.values()].map((row) => {
        const isTroupeOwner = ownTroupe?.id === row.troupeId;
        const memberRow = memberByPremiseId.get(row.id) ?? null;
        const member = memberRow
          ? { role: memberRow.role, canBook: memberRow.canBook }
          : null;
        const canManage =
          isTroupeOwner || (member != null && isManagerRole(member.role));
        const canBook =
          canManage ||
          (member != null &&
            member.canBook &&
            (member.role === PremiseMemberRole.tenant ||
              member.role === PremiseMemberRole.manager ||
              member.role === PremiseMemberRole.owner));
        return serializePremise(row, {
          isTroupeOwner,
          member,
          canView: true,
          canManage,
          canBook,
        });
      }),
    };
  }

  async listMyPremises(userId: string, userEmail: string) {
    return this.listPremises(userId, userEmail);
  }

  async getPremise(userId: string, userEmail: string, premiseId: string) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    const row = await this.prisma.premise.findUnique({
      where: { id: premiseId },
      select: premiseSelect,
    });
    if (!row) throw new NotFoundException('Premise not found');
    return serializePremise(row, access);
  }

  async createPremise(userId: string, body: CreatePremiseDto) {
    const troupe = await this.getOrCreateMyTroupe(userId);
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');

    const created = await this.prisma.premise.create({
      data: {
        troupeId: troupe.id,
        name,
        kind: body.kind ?? 'OWNED',
        address: body.address?.trim() || null,
        capacity: body.capacity ?? null,
        notes: body.notes?.trim() || null,
      },
      select: premiseSelect,
    });

    return serializePremise(created, {
      isTroupeOwner: true,
      member: null,
      canView: true,
      canManage: true,
      canBook: true,
    });
  }

  async updatePremise(
    userId: string,
    userEmail: string,
    premiseId: string,
    body: UpdatePremiseDto,
  ) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    this.assertCanManage(access);

    const data: Prisma.PremiseUpdateInput = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw new BadRequestException('name is required');
      data.name = name;
    }
    if (body.kind !== undefined) data.kind = body.kind;
    if (body.address !== undefined) {
      data.address =
        body.address == null ? null : String(body.address).trim() || null;
    }
    if (body.capacity !== undefined) data.capacity = body.capacity;
    if (body.notes !== undefined) {
      data.notes =
        body.notes == null ? null : String(body.notes).trim() || null;
    }

    const updated = await this.prisma.premise.update({
      where: { id: premiseId },
      data,
      select: premiseSelect,
    });
    return serializePremise(updated, access);
  }

  async deletePremise(userId: string, userEmail: string, premiseId: string) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    this.assertCanManage(access);
    await this.prisma.premise.delete({ where: { id: premiseId } });
    return { ok: true };
  }

  async listSlots(
    userId: string,
    userEmail: string,
    premiseId: string,
    from?: string,
    to?: string,
  ) {
    await this.resolveAccess(userId, userEmail, premiseId);
    const { fromDate, toDate } = this.parseRange(from, to);

    const rows = await this.prisma.premiseSlot.findMany({
      where: {
        premiseId,
        ...(fromDate || toDate
          ? {
              startsAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      select: slotSelect,
      orderBy: { startsAt: 'asc' },
    });

    return { slots: rows.map(serializeSlot) };
  }

  async createSlot(
    userId: string,
    userEmail: string,
    premiseId: string,
    body: CreatePremiseSlotDto,
  ) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    this.assertCanBook(access);

    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Invalid startsAt');
    }
    const durationMin = body.durationMin;
    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException('title is required');

    const conflicts = await this.findConflictingSlots(
      premiseId,
      startsAt,
      durationMin,
    );
    if (conflicts.length > 0) {
      throw new ConflictException('Слот пересекается с существующей бронью');
    }

    const email = normalizeEmail(userEmail);
    const created = await this.prisma.premiseSlot.create({
      data: {
        premiseId,
        startsAt,
        durationMin,
        title,
        purpose: body.purpose?.trim() || null,
        rentalNotes: body.rentalNotes?.trim() || null,
        contactEmail: body.contactEmail
          ? normalizeEmail(body.contactEmail)
          : email,
        contactName: body.contactName?.trim() || null,
        status: body.status ?? PremiseSlotStatus.confirmed,
        createdByEmail: email,
      },
      select: slotSelect,
    });

    return serializeSlot(created);
  }

  async updateSlot(
    userId: string,
    userEmail: string,
    premiseId: string,
    slotId: string,
    body: UpdatePremiseSlotDto,
  ) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    const existing = await this.prisma.premiseSlot.findFirst({
      where: { id: slotId, premiseId },
      select: slotSelect,
    });
    if (!existing) throw new NotFoundException('Slot not found');
    if (!this.canEditSlot(access, userEmail, existing)) {
      throw new ForbiddenException('Недостаточно прав для изменения слота');
    }

    const startsAt = body.startsAt ? new Date(body.startsAt) : existing.startsAt;
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Invalid startsAt');
    }
    const durationMin = body.durationMin ?? existing.durationMin;

    const conflicts = await this.findConflictingSlots(
      premiseId,
      startsAt,
      durationMin,
      slotId,
    );
    if (conflicts.length > 0) {
      throw new ConflictException('Слот пересекается с существующей бронью');
    }

    const data: Prisma.PremiseSlotUpdateInput = {};
    if (body.startsAt !== undefined) data.startsAt = startsAt;
    if (body.durationMin !== undefined) data.durationMin = durationMin;
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) throw new BadRequestException('title is required');
      data.title = title;
    }
    if (body.purpose !== undefined) {
      data.purpose =
        body.purpose == null ? null : String(body.purpose).trim() || null;
    }
    if (body.rentalNotes !== undefined) {
      data.rentalNotes =
        body.rentalNotes == null
          ? null
          : String(body.rentalNotes).trim() || null;
    }
    if (body.contactEmail !== undefined) {
      data.contactEmail =
        body.contactEmail == null
          ? null
          : normalizeEmail(body.contactEmail);
    }
    if (body.contactName !== undefined) {
      data.contactName =
        body.contactName == null
          ? null
          : String(body.contactName).trim() || null;
    }
    if (body.status !== undefined) data.status = body.status;

    const updated = await this.prisma.premiseSlot.update({
      where: { id: slotId },
      data,
      select: slotSelect,
    });
    return serializeSlot(updated);
  }

  async deleteSlot(
    userId: string,
    userEmail: string,
    premiseId: string,
    slotId: string,
  ) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    const existing = await this.prisma.premiseSlot.findFirst({
      where: { id: slotId, premiseId },
      select: slotSelect,
    });
    if (!existing) throw new NotFoundException('Slot not found');
    if (!this.canEditSlot(access, userEmail, existing)) {
      throw new ForbiddenException('Недостаточно прав для удаления слота');
    }
    await this.prisma.premiseSlot.delete({ where: { id: slotId } });
    return { ok: true };
  }

  async listMembers(userId: string, userEmail: string, premiseId: string) {
    await this.resolveAccess(userId, userEmail, premiseId);
    const rows = await this.prisma.premiseMember.findMany({
      where: { premiseId },
      select: memberSelect,
      orderBy: { email: 'asc' },
    });
    return { members: rows.map(serializeMember) };
  }

  async addMember(
    userId: string,
    userEmail: string,
    premiseId: string,
    body: AddPremiseMemberDto,
  ) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    this.assertCanManage(access);

    const email = normalizeEmail(body.email);
    const role = body.role ?? PremiseMemberRole.viewer;
    const canBook =
      body.canBook ??
      (role === PremiseMemberRole.tenant ||
        role === PremiseMemberRole.manager ||
        role === PremiseMemberRole.owner);

    try {
      const created = await this.prisma.premiseMember.create({
        data: { premiseId, email, role, canBook },
        select: memberSelect,
      });
      return serializeMember(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Участник с таким email уже добавлен в помещение',
        );
      }
      throw error;
    }
  }

  async updateMember(
    userId: string,
    userEmail: string,
    premiseId: string,
    memberId: string,
    body: UpdatePremiseMemberDto,
  ) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    this.assertCanManage(access);

    const existing = await this.prisma.premiseMember.findFirst({
      where: { id: memberId, premiseId },
      select: memberSelect,
    });
    if (!existing) throw new NotFoundException('Member not found');

    const data: Prisma.PremiseMemberUpdateInput = {};
    if (body.role !== undefined) data.role = body.role;
    if (body.canBook !== undefined) data.canBook = body.canBook;

    const updated = await this.prisma.premiseMember.update({
      where: { id: memberId },
      data,
      select: memberSelect,
    });
    return serializeMember(updated);
  }

  async removeMember(
    userId: string,
    userEmail: string,
    premiseId: string,
    memberId: string,
  ) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    this.assertCanManage(access);

    const res = await this.prisma.premiseMember.deleteMany({
      where: { id: memberId, premiseId },
    });
    if (res.count === 0) throw new NotFoundException('Member not found');
    return { ok: true };
  }
}
