import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PremiseAgreementStatus,
  PremiseBookedAsKind,
  PremiseMemberRole,
  PremiseRecurrenceType,
  PremiseRentalStatus,
  PremiseSlotStatus,
  PremiseUsageType,
  Prisma,
  WorkspaceRole,
  WorkspaceType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddPremiseMemberDto } from './dto/add-premise-member.dto';
import { CreatePremiseDto } from './dto/create-premise.dto';
import {
  CreatePremiseRentalDto,
  PremiseRentalScheduleDto,
} from './dto/create-premise-rental.dto';
import { CreatePremiseRentalAgreementDto } from './dto/create-premise-rental-agreement.dto';
import { CreatePremiseSlotDto } from './dto/create-premise-slot.dto';
import { UpdatePremiseDto } from './dto/update-premise.dto';
import { UpdatePremiseMemberDto } from './dto/update-premise-member.dto';
import { UpdatePremiseRentalPaymentDto } from './dto/update-premise-rental-payment.dto';
import { UpdatePremiseRentalStatusDto } from './dto/update-premise-rental-status.dto';
import { UpdatePremiseSlotDto } from './dto/update-premise-slot.dto';
import { PremiseAgreementDocumentsService } from './premise-agreement-documents.service';

function normalizeEmail(v: unknown): string {
  const email = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!email) throw new BadRequestException('email is required');
  return email;
}

function decodeMulterFileName(fileName: string): string {
  const raw = String(fileName ?? '').trim();
  if (!raw) return 'document.pdf';
  const looksMojibake = /[ÐÑÃÂ]/.test(raw);
  if (!looksMojibake) return raw;
  try {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8');
    if (!decoded || decoded.includes('\uFFFD')) return raw;
    return decoded;
  } catch {
    return raw;
  }
}

function rubToKopecks(rub: number): number {
  if (!Number.isInteger(rub) || rub < 0) {
    throw new BadRequestException(
      'rentalAmountRub must be a non-negative integer',
    );
  }
  return rub * 100;
}

type WeeklyAvailabilityDay = {
  weekday: number;
  startsAtMin: number;
  endsAtMin: number;
};

function normalizeWeeklyAvailability(
  days: WeeklyAvailabilityDay[],
): WeeklyAvailabilityDay[] {
  const weekdays = new Set<number>();
  const normalizedDays = days.map((day) => {
    if (weekdays.has(day.weekday)) {
      throw new BadRequestException('День недели указан несколько раз');
    }
    if (day.startsAtMin >= day.endsAtMin) {
      throw new BadRequestException(
        'Начало рабочего времени должно быть раньше окончания',
      );
    }
    weekdays.add(day.weekday);
    return {
      weekday: day.weekday,
      startsAtMin: day.startsAtMin,
      endsAtMin: day.endsAtMin,
    };
  });

  return normalizedDays.sort((left, right) => left.weekday - right.weekday);
}

type RentalOccurrence = {
  startsAt: Date;
  durationMin: number;
};

function parseIsoDateOnly(raw: string, fieldName: string): Date {
  const datePart = String(raw ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    throw new BadRequestException(`Invalid ${fieldName}`);
  }
  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid ${fieldName}`);
  }
  return parsed;
}

function localDateAtMinutes(
  date: Date,
  startsAtMin: number,
  timezoneOffsetMin: number,
): Date {
  const localMidnightUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return new Date(
    localMidnightUtc + startsAtMin * 60 * 1000 + timezoneOffsetMin * 60 * 1000,
  );
}

function generateWeeklyOccurrences(
  startsOn: Date,
  endsOn: Date,
  schedules: PremiseRentalScheduleDto[],
  timezoneOffsetMin: number,
): RentalOccurrence[] {
  const schedulesByWeekday = new Map(
    schedules.map((schedule) => [schedule.weekday, schedule]),
  );
  if (schedulesByWeekday.size !== schedules.length) {
    throw new BadRequestException('День недели указан несколько раз');
  }

  const occurrences: RentalOccurrence[] = [];
  const cursor = new Date(
    Date.UTC(
      startsOn.getUTCFullYear(),
      startsOn.getUTCMonth(),
      startsOn.getUTCDate(),
    ),
  );
  const lastDate = Date.UTC(
    endsOn.getUTCFullYear(),
    endsOn.getUTCMonth(),
    endsOn.getUTCDate(),
  );

  while (cursor.getTime() <= lastDate) {
    const schedule = schedulesByWeekday.get(cursor.getUTCDay());
    if (schedule) {
      if (schedule.startsAtMin + schedule.durationMin > 1440) {
        throw new BadRequestException(
          'Регулярная бронь не должна выходить за пределы дня',
        );
      }
      occurrences.push({
        startsAt: localDateAtMinutes(
          cursor,
          schedule.startsAtMin,
          timezoneOffsetMin,
        ),
        durationMin: schedule.durationMin,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (occurrences.length === 0) {
    throw new BadRequestException('В выбранном периоде нет посещений');
  }
  if (occurrences.length > 370) {
    throw new BadRequestException('Серия не может содержать больше 370 броней');
  }
  return occurrences;
}

function generateMonthlyPayments(
  startsOn: Date,
  endsOn: Date,
  monthlyAmountRub: number,
  paymentDueDay: number,
) {
  const payments: {
    periodStart: Date;
    dueAt: Date;
    amountKopecks: number;
  }[] = [];
  const cursor = new Date(
    Date.UTC(startsOn.getUTCFullYear(), startsOn.getUTCMonth(), 1),
  );
  const lastMonth = Date.UTC(endsOn.getUTCFullYear(), endsOn.getUTCMonth(), 1);

  while (cursor.getTime() <= lastMonth) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const dueDay = Math.min(paymentDueDay, daysInMonth);
    payments.push({
      periodStart: new Date(Date.UTC(year, month, 1)),
      dueAt: new Date(Date.UTC(year, month, dueDay, 23, 59, 59, 999)),
      amountKopecks: rubToKopecks(monthlyAmountRub),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return payments;
}

type PremiseAccess = {
  premise: {
    id: string;
    troupeId: string | null;
    theaterId: string | null;
    studioId: string | null;
    troupe: { ownerUserId: string; title: string } | null;
    theater: {
      title: string;
      workspace: { memberships: { id: string; role: WorkspaceRole }[] };
    } | null;
    studio: {
      ownerUserId: string;
      title: string;
      members: { role: string }[];
    } | null;
  };
  isOrganizationManager: boolean;
  member: {
    role: PremiseMemberRole;
    canBook: boolean;
  } | null;
  canView: boolean;
  canManage: boolean;
  canBook: boolean;
};

type PremiseBookingActor = {
  kind: PremiseBookedAsKind;
  id: string | null;
  title: string;
};

type ResolvedBookedAs = {
  kind: PremiseBookedAsKind;
  id: string | null;
  title: string;
};

const premiseSelect = {
  id: true,
  troupeId: true,
  theaterId: true,
  studioId: true,
  name: true,
  kind: true,
  address: true,
  capacity: true,
  notes: true,
  availability: {
    select: {
      weekday: true,
      startsAtMin: true,
      endsAtMin: true,
    },
    orderBy: { weekday: 'asc' as const },
  },
  createdAt: true,
  updatedAt: true,
  troupe: { select: { ownerUserId: true, title: true } },
  theater: { select: { title: true } },
  studio: { select: { ownerUserId: true, title: true } },
} as const;

const rentalSummarySelect = {
  id: true,
  usageType: true,
  recurrenceType: true,
  agreementRequested: true,
  status: true,
  bookedAsKind: true,
  bookedAsId: true,
  bookedAsTitle: true,
  createdByEmail: true,
  confirmedByEmail: true,
  confirmedAt: true,
  agreement: { select: { id: true, number: true, status: true } },
} as const;

const slotSelect = {
  id: true,
  premiseId: true,
  rentalId: true,
  startsAt: true,
  durationMin: true,
  title: true,
  purpose: true,
  rentalNotes: true,
  rentalAmountKopecks: true,
  paymentStatus: true,
  contactEmail: true,
  contactName: true,
  contactPhone: true,
  status: true,
  createdByEmail: true,
  createdAt: true,
  updatedAt: true,
  rental: { select: rentalSummarySelect },
} as const;

const rentalSelect = {
  id: true,
  premiseId: true,
  usageType: true,
  recurrenceType: true,
  title: true,
  purpose: true,
  rentalNotes: true,
  contactEmail: true,
  contactName: true,
  contactPhone: true,
  bookedAsKind: true,
  bookedAsId: true,
  bookedAsTitle: true,
  startsOn: true,
  endsOn: true,
  timezoneOffsetMin: true,
  monthlyAmountKopecks: true,
  paymentDueDay: true,
  agreementRequested: true,
  status: true,
  createdByEmail: true,
  confirmedByEmail: true,
  confirmedAt: true,
  createdAt: true,
  updatedAt: true,
  schedules: {
    select: {
      id: true,
      weekday: true,
      startsAtMin: true,
      durationMin: true,
    },
    orderBy: { weekday: 'asc' as const },
  },
  agreement: {
    select: {
      id: true,
      number: true,
      status: true,
      landlordName: true,
      landlordDetails: true,
      tenantName: true,
      tenantDetails: true,
      signedAt: true,
      createdAt: true,
      updatedAt: true,
      documents: {
        select: {
          id: true,
          kind: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' as const },
      },
    },
  },
  payments: {
    select: {
      id: true,
      periodStart: true,
      dueAt: true,
      amountKopecks: true,
      status: true,
      paidAt: true,
    },
    orderBy: { periodStart: 'asc' as const },
  },
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
  const { availability, ...premise } = row;
  return {
    ...premise,
    weeklyAvailability: availability,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ownerTitle:
      row.theater?.title ?? row.studio?.title ?? row.troupe?.title ?? '',
    canManage: access.canManage,
    canBook: access.canBook,
    myRole: access.isOrganizationManager
      ? ('organization_admin' as const)
      : (access.member?.role ?? null),
  };
}

function serializeSlot(
  row: Prisma.PremiseSlotGetPayload<{ select: typeof slotSelect }>,
) {
  return {
    ...row,
    startsAt: row.startsAt.toISOString(),
    rentalAmountRub:
      row.rentalAmountKopecks == null ? null : row.rentalAmountKopecks / 100,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    rental: row.rental
      ? {
          ...row.rental,
          confirmedAt: row.rental.confirmedAt?.toISOString() ?? null,
        }
      : null,
  };
}

function serializeRental(
  row: Prisma.PremiseRentalGetPayload<{ select: typeof rentalSelect }>,
) {
  return {
    ...row,
    startsOn: row.startsOn.toISOString(),
    endsOn: row.endsOn?.toISOString() ?? null,
    monthlyAmountRub:
      row.monthlyAmountKopecks == null ? null : row.monthlyAmountKopecks / 100,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    agreement: row.agreement
      ? {
          ...row.agreement,
          signedAt: row.agreement.signedAt?.toISOString() ?? null,
          createdAt: row.agreement.createdAt.toISOString(),
          updatedAt: row.agreement.updatedAt.toISOString(),
          documents: row.agreement.documents.map((document) => ({
            ...document,
            createdAt: document.createdAt.toISOString(),
          })),
        }
      : null,
    payments: row.payments.map((payment) => ({
      ...payment,
      amountRub: payment.amountKopecks / 100,
      periodStart: payment.periodStart.toISOString(),
      dueAt: payment.dueAt.toISOString(),
      paidAt: payment.paidAt?.toISOString() ?? null,
    })),
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

function profileDisplayTitle(profile: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} | null, email: string): string {
  const displayName = String(profile?.displayName ?? '').trim();
  if (displayName) return displayName;
  const fullName = [profile?.firstName, profile?.lastName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return fullName || email;
}

function buildManagerOrgActors(access: PremiseAccess): PremiseBookingActor[] {
  const actors: PremiseBookingActor[] = [];
  if (access.premise.theaterId && access.premise.theater?.title) {
    actors.push({
      kind: PremiseBookedAsKind.theater,
      id: access.premise.theaterId,
      title: access.premise.theater.title,
    });
  }
  if (access.premise.troupeId && access.premise.troupe?.title) {
    actors.push({
      kind: PremiseBookedAsKind.troupe,
      id: access.premise.troupeId,
      title: access.premise.troupe.title,
    });
  }
  if (access.premise.studioId && access.premise.studio?.title) {
    actors.push({
      kind: PremiseBookedAsKind.studio,
      id: access.premise.studioId,
      title: access.premise.studio.title,
    });
  }
  return actors;
}

@Injectable()
export class PremisesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agreementDocuments: PremiseAgreementDocumentsService,
  ) {}

  private async getOrCreateMyTroupe(userId: string) {
    const existing = await this.prisma.troupe.findFirst({
      where: { ownerUserId: userId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    const theater = await this.prisma.theater.findFirst({
      where: {
        workspace: {
          memberships: {
            some: { userId, role: { in: ['OWNER', 'ADMIN'] } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true },
    });
    if (!theater) {
      throw new BadRequestException(
        'Сначала создайте театр — труппа существует только внутри театра',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const troupe = await tx.troupe.create({
        data: {
          title: 'Основная труппа',
          theater: { connect: { id: theater.id } },
          owner: { connect: { id: userId } },
          workspace: {
            create: {
              type: WorkspaceType.TROUPE,
              name: `${theater.title} — Основная труппа`,
              memberships: { create: { userId, role: WorkspaceRole.OWNER } },
            },
          },
        },
      });
      await tx.theaterTroupe.create({
        data: {
          theaterId: theater.id,
          troupeId: troupe.id,
          participationType: 'HOME',
        },
      });
      return troupe;
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
        theaterId: true,
        studioId: true,
        troupe: { select: { ownerUserId: true, title: true } },
        theater: {
          select: {
            title: true,
            workspace: {
              select: {
                memberships: {
                  where: { userId },
                  select: { id: true, role: true },
                },
              },
            },
          },
        },
        studio: {
          select: {
            ownerUserId: true,
            title: true,
            members: {
              where: {
                OR: [{ userId }, { email: userEmail }],
              },
              select: { role: true },
            },
          },
        },
      },
    });
    if (!premise) throw new NotFoundException('Premise not found');

    const theaterMembership = premise.theater?.workspace.memberships[0] ?? null;
    const studioMembership = premise.studio?.members[0] ?? null;
    const isTheaterManager =
      theaterMembership?.role === WorkspaceRole.OWNER ||
      theaterMembership?.role === WorkspaceRole.ADMIN;
    const isStudioManager =
      premise.studio?.ownerUserId === userId ||
      studioMembership?.role === 'owner' ||
      studioMembership?.role === 'teacher';
    const isOrganizationManager =
      premise.troupe?.ownerUserId === userId ||
      isTheaterManager ||
      isStudioManager;
    const isOrganizationMember =
      theaterMembership != null ||
      premise.studio?.ownerUserId === userId ||
      studioMembership != null;
    const member = await this.prisma.premiseMember.findUnique({
      where: {
        premiseId_email: { premiseId, email: userEmail },
      },
      select: { role: true, canBook: true },
    });

    const canView =
      isOrganizationManager || isOrganizationMember || member != null;
    if (!canView) {
      throw new ForbiddenException('Нет доступа к этому помещению');
    }

    const canManage =
      isOrganizationManager || (member != null && isManagerRole(member.role));
    const canBook =
      canManage ||
      (member != null &&
        member.canBook &&
        (member.role === PremiseMemberRole.tenant ||
          member.role === PremiseMemberRole.manager ||
          member.role === PremiseMemberRole.owner));

    return {
      premise,
      isOrganizationManager,
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

  private canEditRental(
    access: PremiseAccess,
    userEmail: string,
    rental: { createdByEmail: string; contactEmail: string | null },
  ): boolean {
    if (access.canManage) return true;
    if (!access.canBook) return false;
    const email = normalizeEmail(userEmail);
    const createdBy = rental.createdByEmail.trim().toLowerCase();
    const contact = rental.contactEmail?.trim().toLowerCase() ?? '';
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

  private async findRentalConflicts(
    premiseId: string,
    occurrences: RentalOccurrence[],
  ) {
    const slots = await this.prisma.premiseSlot.findMany({
      where: {
        premiseId,
        status: { not: PremiseSlotStatus.cancelled },
      },
      select: slotSelect,
    });

    return occurrences.flatMap((occurrence) => {
      const occurrenceStart = occurrence.startsAt.getTime();
      const occurrenceEnd =
        occurrenceStart + occurrence.durationMin * 60 * 1000;
      return slots.filter((slot) => {
        const slotStart = slot.startsAt.getTime();
        const slotEnd = slotStart + slot.durationMin * 60 * 1000;
        return slotStart < occurrenceEnd && slotEnd > occurrenceStart;
      });
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

  async listPremises(
    userId: string,
    userEmail: string,
    theaterId?: string,
    studioId?: string,
  ) {
    const email = normalizeEmail(userEmail);
    if (theaterId && studioId) {
      throw new BadRequestException(
        'Укажите только одну организацию для списка помещений',
      );
    }

    const rows = await this.prisma.premise.findMany({
      where: {
        ...(theaterId ? { theaterId } : {}),
        ...(studioId ? { studioId } : {}),
        OR: [
          { troupe: { ownerUserId: userId } },
          {
            theater: {
              workspace: { memberships: { some: { userId } } },
            },
          },
          { studio: { ownerUserId: userId } },
          {
            studio: {
              members: {
                some: {
                  OR: [{ userId }, { email }],
                },
              },
            },
          },
          { members: { some: { email } } },
        ],
      },
      select: premiseSelect,
      orderBy: [{ name: 'asc' }],
    });

    const premises = await Promise.all(
      rows.map(async (row) => {
        const access = await this.resolveAccess(userId, email, row.id);
        return serializePremise(row, access);
      }),
    );
    return {
      premises,
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
    const bookingActors = await this.buildBookingActors(
      access,
      userId,
      userEmail,
    );
    return {
      ...serializePremise(row, access),
      bookingActors,
    };
  }

  private async listRepresentableOrgActors(
    userId: string,
    userEmailRaw: string,
  ): Promise<PremiseBookingActor[]> {
    const userEmail = normalizeEmail(userEmailRaw);
    const [theaters, studios, troupes] = await Promise.all([
      this.prisma.theater.findMany({
        where: {
          workspace: {
            memberships: {
              some: {
                userId,
                role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] },
              },
            },
          },
        },
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
      }),
      this.prisma.studio.findMany({
        where: {
          OR: [
            { ownerUserId: userId },
            {
              members: {
                some: {
                  role: { in: ['owner', 'teacher'] },
                  OR: [{ userId }, { email: userEmail }],
                },
              },
            },
          ],
        },
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
      }),
      this.prisma.troupe.findMany({
        where: {
          OR: [
            { ownerUserId: userId },
            {
              workspace: {
                memberships: {
                  some: {
                    userId,
                    role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] },
                  },
                },
              },
            },
          ],
        },
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
      }),
    ]);

    return [
      ...theaters.map((theater) => ({
        kind: PremiseBookedAsKind.theater,
        id: theater.id,
        title: theater.title,
      })),
      ...studios.map((studio) => ({
        kind: PremiseBookedAsKind.studio,
        id: studio.id,
        title: studio.title,
      })),
      ...troupes.map((troupe) => ({
        kind: PremiseBookedAsKind.troupe,
        id: troupe.id,
        title: troupe.title,
      })),
    ];
  }

  private async buildBookingActors(
    access: PremiseAccess,
    userId: string,
    userEmailRaw: string,
  ): Promise<PremiseBookingActor[]> {
    const userEmail = normalizeEmail(userEmailRaw);
    const profile = await this.prisma.userProfile.findUnique({
      where: { email: userEmail },
      select: { displayName: true, firstName: true, lastName: true },
    });
    const actors: PremiseBookingActor[] = [
      {
        kind: PremiseBookedAsKind.user,
        id: userId,
        title: profileDisplayTitle(profile, userEmail),
      },
    ];
    if (access.canManage) {
      actors.push(...buildManagerOrgActors(access));
      actors.push({
        kind: PremiseBookedAsKind.external,
        id: null,
        title: 'Внешний арендатор',
      });
    }

    const representable = await this.listRepresentableOrgActors(
      userId,
      userEmail,
    );
    const seen = new Set(
      actors
        .filter((actor) => actor.id)
        .map((actor) => `${actor.kind}:${actor.id}`),
    );
    for (const actor of representable) {
      if (!actor.id) continue;
      const key = `${actor.kind}:${actor.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      actors.push(actor);
    }

    return actors;
  }

  private async resolveBookedAs(
    access: PremiseAccess,
    userId: string,
    userEmailRaw: string,
    body: Pick<
      CreatePremiseRentalDto,
      'bookedAsKind' | 'bookedAsId' | 'bookedAsTitle' | 'contactName'
    >,
  ): Promise<ResolvedBookedAs> {
    const actors = await this.buildBookingActors(access, userId, userEmailRaw);
    const requestedKind = body.bookedAsKind ?? actors[0]?.kind;
    if (!requestedKind) {
      throw new BadRequestException('Не удалось определить арендатора');
    }
    const matched = actors.find((actor) => {
      if (actor.kind !== requestedKind) return false;
      if (requestedKind === PremiseBookedAsKind.external) return true;
      if (body.bookedAsId == null || body.bookedAsId === '') return true;
      return actor.id === body.bookedAsId;
    });
    if (!matched) {
      throw new ForbiddenException(
        'Нельзя бронировать от имени выбранной сущности',
      );
    }
    if (matched.kind === PremiseBookedAsKind.external) {
      const externalTitle =
        String(body.bookedAsTitle ?? '').trim() ||
        String(body.contactName ?? '').trim() ||
        matched.title;
      return {
        kind: PremiseBookedAsKind.external,
        id: null,
        title: externalTitle,
      };
    }
    return {
      kind: matched.kind,
      id: matched.id,
      title: matched.title,
    };
  }

  async createPremise(userId: string, body: CreatePremiseDto) {
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');
    if (body.theaterId && body.studioId) {
      throw new BadRequestException(
        'Помещение может принадлежать только одной организации',
      );
    }

    let owner:
      | { theaterId: string; studioId?: never; troupeId?: never }
      | { studioId: string; theaterId?: never; troupeId?: never }
      | { troupeId: string; theaterId?: never; studioId?: never };

    if (body.theaterId) {
      const theater = await this.prisma.theater.findFirst({
        where: {
          id: body.theaterId,
          workspace: {
            memberships: {
              some: { userId, role: { in: ['OWNER', 'ADMIN'] } },
            },
          },
        },
        select: { id: true },
      });
      if (!theater) {
        throw new ForbiddenException(
          'Недостаточно прав для добавления помещения театра',
        );
      }
      owner = { theaterId: theater.id };
    } else if (body.studioId) {
      const studio = await this.prisma.studio.findFirst({
        where: {
          id: body.studioId,
          OR: [
            { ownerUserId: userId },
            {
              members: {
                some: { userId, role: { in: ['owner', 'teacher'] } },
              },
            },
          ],
        },
        select: { id: true },
      });
      if (!studio) {
        throw new ForbiddenException(
          'Недостаточно прав для добавления помещения студии',
        );
      }
      owner = { studioId: studio.id };
    } else {
      const troupe = await this.getOrCreateMyTroupe(userId);
      owner = { troupeId: troupe.id };
    }

    const created = await this.prisma.premise.create({
      data: {
        ...owner,
        name,
        kind: body.kind ?? 'OWNED',
        address: body.address?.trim() || null,
        capacity: body.capacity ?? null,
        availability: body.weeklyAvailability
          ? {
              create: normalizeWeeklyAvailability(body.weeklyAvailability),
            }
          : undefined,
        notes: body.notes?.trim() || null,
      },
      select: premiseSelect,
    });

    return serializePremise(created, {
      isOrganizationManager: true,
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
    if (body.weeklyAvailability !== undefined) {
      data.availability = {
        deleteMany: {},
        create: normalizeWeeklyAvailability(body.weeklyAvailability),
      };
    }
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

  async listRentals(userId: string, userEmail: string, premiseId: string) {
    await this.resolveAccess(userId, userEmail, premiseId);
    const rentals = await this.prisma.premiseRental.findMany({
      where: { premiseId },
      select: rentalSelect,
      orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
    });
    return { rentals: rentals.map(serializeRental) };
  }

  async getRental(
    userId: string,
    userEmail: string,
    premiseId: string,
    rentalId: string,
  ) {
    await this.resolveAccess(userId, userEmail, premiseId);
    const rental = await this.prisma.premiseRental.findFirst({
      where: { id: rentalId, premiseId },
      select: rentalSelect,
    });
    if (!rental) throw new NotFoundException('Rental not found');
    return serializeRental(rental);
  }

  async createRental(
    userId: string,
    userEmail: string,
    premiseId: string,
    body: CreatePremiseRentalDto,
  ) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    this.assertCanBook(access);

    const email = normalizeEmail(userEmail);
    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException('title is required');
    const bookedAs = await this.resolveBookedAs(access, userId, email, body);
    const timezoneOffsetMin = body.timezoneOffsetMin ?? 0;
    const requestedAgreement = body.agreementRequested === true;
    const contactEmail = body.contactEmail
      ? normalizeEmail(body.contactEmail)
      : email;
    const startsOn = parseIsoDateOnly(body.startsOn, 'startsOn');

    let endsOn: Date | null = null;
    let occurrenceEndsOn: Date | null = null;
    let schedules: PremiseRentalScheduleDto[] = [];
    let occurrences: RentalOccurrence[] = [];

    if (body.recurrenceType === PremiseRecurrenceType.once) {
      if (!body.startsAt || !body.durationMin) {
        throw new BadRequestException(
          'Для разовой брони укажите начало и длительность',
        );
      }
      const startsAt = new Date(body.startsAt);
      if (Number.isNaN(startsAt.getTime())) {
        throw new BadRequestException('Invalid startsAt');
      }
      occurrences = [{ startsAt, durationMin: body.durationMin }];
    } else {
      const isIndefinite = body.indefinite === true;
      if ((!isIndefinite && !body.endsOn) || !body.schedules?.length) {
        throw new BadRequestException(
          'Для регулярной аренды укажите период и расписание',
        );
      }
      occurrenceEndsOn = isIndefinite
        ? new Date(
            Date.UTC(
              startsOn.getUTCFullYear() + 1,
              startsOn.getUTCMonth(),
              startsOn.getUTCDate(),
            ),
          )
        : parseIsoDateOnly(body.endsOn!, 'endsOn');
      endsOn = isIndefinite ? null : occurrenceEndsOn;
      if (occurrenceEndsOn < startsOn) {
        throw new BadRequestException('Некорректный период аренды');
      }
      schedules = body.schedules;
      occurrences = generateWeeklyOccurrences(
        startsOn,
        occurrenceEndsOn,
        schedules,
        timezoneOffsetMin,
      );
    }

    const isCommercial = body.usageType === PremiseUsageType.commercial;
    if (
      isCommercial &&
      body.recurrenceType === PremiseRecurrenceType.weekly &&
      (body.monthlyAmountRub === undefined || body.paymentDueDay === undefined)
    ) {
      throw new BadRequestException(
        'Для регулярной аренды укажите месячную сумму и день оплаты',
      );
    }
    if (
      isCommercial &&
      body.recurrenceType === PremiseRecurrenceType.once &&
      body.amountRub === undefined
    ) {
      throw new BadRequestException('Укажите стоимость разовой аренды');
    }
    if (
      requestedAgreement &&
      (!body.landlordName?.trim() || !body.tenantName?.trim())
    ) {
      throw new BadRequestException(
        'Для договора укажите арендодателя и арендатора',
      );
    }

    const conflicts = await this.findRentalConflicts(premiseId, occurrences);
    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      throw new ConflictException(
        `Бронь пересекается со слотом «${conflict.title}»`,
      );
    }

    const rentalStatus =
      requestedAgreement || !access.canManage
        ? PremiseRentalStatus.pending
        : PremiseRentalStatus.active;
    const slotStatus =
      rentalStatus === PremiseRentalStatus.active
        ? PremiseSlotStatus.confirmed
        : PremiseSlotStatus.pending;
    const monthlyPayments =
      isCommercial &&
      body.recurrenceType === PremiseRecurrenceType.weekly &&
      occurrenceEndsOn &&
      body.monthlyAmountRub !== undefined &&
      body.paymentDueDay !== undefined
        ? generateMonthlyPayments(
            startsOn,
            occurrenceEndsOn,
            body.monthlyAmountRub,
            body.paymentDueDay,
          )
        : [];
    const agreementNumber = `П-${new Date().getUTCFullYear()}-${Date.now()
      .toString(36)
      .toUpperCase()}`;
    const termsSnapshot = {
      premiseId,
      usageType: body.usageType,
      recurrenceType: body.recurrenceType,
      title,
      purpose: body.purpose?.trim() || null,
      startsOn: startsOn.toISOString(),
      endsOn: endsOn?.toISOString() ?? null,
      indefinite: body.indefinite === true,
      schedules,
      amountRub: body.amountRub ?? null,
      monthlyAmountRub: body.monthlyAmountRub ?? null,
      paymentDueDay: body.paymentDueDay ?? null,
      contactEmail,
      contactName: body.contactName?.trim() || null,
      contactPhone: body.contactPhone?.trim() || null,
    };
    const agreementTerms = JSON.parse(
      JSON.stringify(termsSnapshot),
    ) as Prisma.InputJsonValue;

    const rental = await this.prisma.$transaction(async (tx) => {
      const created = await tx.premiseRental.create({
        data: {
          premiseId,
          usageType: body.usageType,
          recurrenceType: body.recurrenceType,
          title,
          purpose: body.purpose?.trim() || null,
          rentalNotes: body.rentalNotes?.trim() || null,
          contactEmail,
          contactName: body.contactName?.trim() || null,
          contactPhone: body.contactPhone?.trim() || null,
          bookedAsKind: bookedAs.kind,
          bookedAsId: bookedAs.id,
          bookedAsTitle: bookedAs.title,
          startsOn,
          endsOn,
          timezoneOffsetMin,
          monthlyAmountKopecks:
            body.monthlyAmountRub === undefined
              ? null
              : rubToKopecks(body.monthlyAmountRub),
          paymentDueDay: body.paymentDueDay ?? null,
          agreementRequested: requestedAgreement,
          status: rentalStatus,
          createdByEmail: email,
          ...(rentalStatus === PremiseRentalStatus.active
            ? { confirmedByEmail: email, confirmedAt: new Date() }
            : {}),
          schedules: schedules.length ? { create: schedules } : undefined,
          payments: monthlyPayments.length
            ? { create: monthlyPayments }
            : undefined,
          agreement: requestedAgreement
            ? {
                create: {
                  number: agreementNumber,
                  status: PremiseAgreementStatus.draft,
                  landlordName: body.landlordName!.trim(),
                  landlordDetails: body.landlordDetails?.trim() || null,
                  tenantName: body.tenantName!.trim(),
                  tenantDetails: body.tenantDetails?.trim() || null,
                  termsSnapshot: agreementTerms,
                },
              }
            : undefined,
        },
      });

      await tx.premiseSlot.createMany({
        data: occurrences.map((occurrence) => ({
          premiseId,
          rentalId: created.id,
          startsAt: occurrence.startsAt,
          durationMin: occurrence.durationMin,
          title,
          purpose: body.purpose?.trim() || null,
          rentalNotes: body.rentalNotes?.trim() || null,
          rentalAmountKopecks:
            body.recurrenceType === PremiseRecurrenceType.once &&
            body.amountRub !== undefined
              ? rubToKopecks(body.amountRub)
              : null,
          contactEmail,
          contactName: body.contactName?.trim() || null,
          contactPhone: body.contactPhone?.trim() || null,
          status: slotStatus,
          createdByEmail: email,
        })),
      });

      return tx.premiseRental.findUniqueOrThrow({
        where: { id: created.id },
        select: rentalSelect,
      });
    });

    return serializeRental(rental);
  }

  async updateRentalStatus(
    userId: string,
    userEmail: string,
    premiseId: string,
    rentalId: string,
    body: UpdatePremiseRentalStatusDto,
  ) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    this.assertCanManage(access);
    const rental = await this.prisma.premiseRental.findFirst({
      where: { id: rentalId, premiseId },
      select: {
        id: true,
      },
    });
    if (!rental) throw new NotFoundException('Rental not found');
    const rentalStatus =
      body.status === 'active'
        ? PremiseRentalStatus.active
        : PremiseRentalStatus.cancelled;
    const slotStatus =
      body.status === 'active'
        ? PremiseSlotStatus.confirmed
        : PremiseSlotStatus.cancelled;
    const reviewerEmail = normalizeEmail(userEmail);
    const confirmedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.premiseRental.update({
        where: { id: rentalId },
        data: {
          status: rentalStatus,
          ...(body.status === 'active'
            ? {
                confirmedByEmail: reviewerEmail,
                confirmedAt,
              }
            : {}),
        },
      }),
      this.prisma.premiseSlot.updateMany({
        where: { rentalId },
        data: { status: slotStatus },
      }),
    ]);
    return this.getRental(userId, userEmail, premiseId, rentalId);
  }

  async updateRentalPayment(
    userId: string,
    userEmail: string,
    premiseId: string,
    rentalId: string,
    paymentId: string,
    body: UpdatePremiseRentalPaymentDto,
  ) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    this.assertCanManage(access);
    const payment = await this.prisma.premiseRentalPayment.findFirst({
      where: {
        id: paymentId,
        rentalId,
        rental: { premiseId },
      },
      select: { id: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    await this.prisma.premiseRentalPayment.update({
      where: { id: paymentId },
      data: {
        status: body.status,
        paidAt: body.status === 'paid' ? new Date() : null,
      },
    });
    return this.getRental(userId, userEmail, premiseId, rentalId);
  }

  async createRentalAgreement(
    userId: string,
    userEmail: string,
    premiseId: string,
    rentalId: string,
    body: CreatePremiseRentalAgreementDto = {},
  ) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    const rental = await this.prisma.premiseRental.findFirst({
      where: { id: rentalId, premiseId },
      select: {
        id: true,
        title: true,
        usageType: true,
        recurrenceType: true,
        purpose: true,
        startsOn: true,
        endsOn: true,
        timezoneOffsetMin: true,
        monthlyAmountKopecks: true,
        paymentDueDay: true,
        contactEmail: true,
        contactName: true,
        contactPhone: true,
        bookedAsTitle: true,
        createdByEmail: true,
        agreement: { select: { id: true } },
        premise: {
          select: {
            name: true,
            theater: { select: { title: true } },
            studio: { select: { title: true } },
            troupe: { select: { title: true } },
          },
        },
        schedules: {
          select: { weekday: true, startsAtMin: true, durationMin: true },
          orderBy: { weekday: 'asc' },
        },
        slots: {
          select: { rentalAmountKopecks: true },
          orderBy: { startsAt: 'asc' },
          take: 1,
        },
      },
    });
    if (!rental) throw new NotFoundException('Rental not found');
    if (!this.canEditRental(access, userEmail, rental)) {
      throw new ForbiddenException('Недостаточно прав для договора');
    }
    if (rental.agreement) {
      return this.getRental(userId, userEmail, premiseId, rentalId);
    }

    const landlordName =
      String(body.landlordName ?? '').trim() ||
      rental.premise.theater?.title ||
      rental.premise.studio?.title ||
      rental.premise.troupe?.title ||
      rental.premise.name;
    const tenantName =
      String(body.tenantName ?? '').trim() ||
      rental.bookedAsTitle ||
      rental.contactName ||
      rental.contactEmail ||
      'Арендатор';
    const agreementNumber = `П-${new Date().getUTCFullYear()}-${Date.now()
      .toString(36)
      .toUpperCase()}`;
    const termsSnapshot = {
      premiseId,
      usageType: rental.usageType,
      recurrenceType: rental.recurrenceType,
      title: rental.title,
      purpose: rental.purpose,
      startsOn: rental.startsOn.toISOString(),
      endsOn: rental.endsOn?.toISOString() ?? null,
      indefinite: rental.endsOn == null,
      schedules: rental.schedules,
      amountRub:
        rental.slots[0]?.rentalAmountKopecks != null
          ? rental.slots[0].rentalAmountKopecks / 100
          : null,
      monthlyAmountRub:
        rental.monthlyAmountKopecks == null
          ? null
          : rental.monthlyAmountKopecks / 100,
      paymentDueDay: rental.paymentDueDay,
      contactEmail: rental.contactEmail,
      contactName: rental.contactName,
      contactPhone: rental.contactPhone,
    };

    await this.prisma.$transaction([
      this.prisma.premiseRental.update({
        where: { id: rentalId },
        data: { agreementRequested: true },
      }),
      this.prisma.premiseRentalAgreement.create({
        data: {
          rentalId,
          number: agreementNumber,
          status: PremiseAgreementStatus.draft,
          landlordName,
          landlordDetails: body.landlordDetails?.trim() || null,
          tenantName,
          tenantDetails: body.tenantDetails?.trim() || null,
          termsSnapshot: JSON.parse(
            JSON.stringify(termsSnapshot),
          ) as Prisma.InputJsonValue,
        },
      }),
    ]);

    return this.getRental(userId, userEmail, premiseId, rentalId);
  }

  async generateRentalAgreement(
    userId: string,
    userEmail: string,
    premiseId: string,
    rentalId: string,
  ) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    const rental = await this.prisma.premiseRental.findFirst({
      where: { id: rentalId, premiseId },
      include: {
        premise: { select: { name: true, address: true } },
        schedules: { orderBy: { weekday: 'asc' } },
        slots: { orderBy: { startsAt: 'asc' }, take: 1 },
        agreement: true,
      },
    });
    if (!rental?.agreement) {
      throw new NotFoundException('Agreement not found');
    }
    if (!this.canEditRental(access, userEmail, rental)) {
      throw new ForbiddenException('Недостаточно прав для договора');
    }

    const weekdayLabels = [
      'Воскресенье',
      'Понедельник',
      'Вторник',
      'Среда',
      'Четверг',
      'Пятница',
      'Суббота',
    ];
    const scheduleLines =
      rental.recurrenceType === PremiseRecurrenceType.weekly
        ? rental.schedules.map((schedule) => {
            const startHours = Math.floor(schedule.startsAtMin / 60);
            const startMinutes = schedule.startsAtMin % 60;
            const endMinutes = schedule.startsAtMin + schedule.durationMin;
            const endHoursValue = Math.floor(endMinutes / 60);
            const endMinutesValue = endMinutes % 60;
            const startLabel = `${String(startHours).padStart(2, '0')}:${String(
              startMinutes,
            ).padStart(2, '0')}`;
            const endLabel = `${String(endHoursValue).padStart(2, '0')}:${String(
              endMinutesValue,
            ).padStart(2, '0')}`;
            return `${weekdayLabels[schedule.weekday]}: ${startLabel}–${endLabel}`;
          })
        : rental.slots[0]
          ? [
              `Дата и время: ${rental.slots[0].startsAt.toLocaleString(
                'ru-RU',
                {
                  timeZone: 'UTC',
                },
              )}, ${rental.slots[0].durationMin} мин.`,
            ]
          : [];
    const amountLabel =
      rental.monthlyAmountKopecks != null
        ? `${(rental.monthlyAmountKopecks / 100).toLocaleString('ru-RU')} ₽ в месяц`
        : rental.slots[0]?.rentalAmountKopecks != null
          ? `${(rental.slots[0].rentalAmountKopecks / 100).toLocaleString('ru-RU')} ₽`
          : null;
    const buffer = await this.agreementDocuments.generatePdf({
      agreementNumber: rental.agreement.number,
      premiseName: rental.premise.name,
      premiseAddress: rental.premise.address,
      landlordName: rental.agreement.landlordName,
      landlordDetails: rental.agreement.landlordDetails,
      tenantName: rental.agreement.tenantName,
      tenantDetails: rental.agreement.tenantDetails,
      title: rental.title,
      startsOn: rental.startsOn,
      endsOn: rental.endsOn,
      recurrenceLabel:
        rental.recurrenceType === PremiseRecurrenceType.weekly
          ? rental.endsOn
            ? 'регулярная'
            : 'регулярная бессрочная'
          : 'разовая',
      scheduleLines,
      amountLabel,
      paymentDueDay: rental.paymentDueDay,
    });
    const fileName = `agreement-${rental.agreement.number}.pdf`;
    const stored = await this.agreementDocuments.storePdf({
      agreementId: rental.agreement.id,
      kind: 'generated',
      fileName,
      buffer,
    });
    await this.prisma.$transaction([
      this.prisma.premiseRentalAgreementDocument.create({
        data: {
          agreementId: rental.agreement.id,
          kind: 'generated',
          fileName,
          storageKey: stored.key,
          mimeType: 'application/pdf',
          sizeBytes: buffer.length,
        },
      }),
      this.prisma.premiseRentalAgreement.update({
        where: { id: rental.agreement.id },
        data: { status: PremiseAgreementStatus.awaiting_signature },
      }),
    ]);
    return this.getRental(userId, userEmail, premiseId, rentalId);
  }

  async uploadRentalAgreementDocument(
    userId: string,
    userEmail: string,
    premiseId: string,
    rentalId: string,
    kind: 'uploaded' | 'signed',
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    const access = await this.resolveAccess(userId, userEmail, premiseId);
    const rental = await this.prisma.premiseRental.findFirst({
      where: { id: rentalId, premiseId },
      select: {
        id: true,
        createdByEmail: true,
        contactEmail: true,
        agreement: { select: { id: true } },
      },
    });
    if (!rental?.agreement) {
      throw new NotFoundException('Agreement not found');
    }
    if (!this.canEditRental(access, userEmail, rental)) {
      throw new ForbiddenException('Недостаточно прав для договора');
    }
    const originalFileName = decodeMulterFileName(file.originalname);
    const isPdf =
      file.mimetype === 'application/pdf' ||
      originalFileName.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      throw new BadRequestException('Разрешены только PDF-документы');
    }
    const stored = await this.agreementDocuments.storePdf({
      agreementId: rental.agreement.id,
      kind,
      fileName: originalFileName,
      buffer: file.buffer,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.premiseRentalAgreementDocument.create({
        data: {
          agreementId: rental.agreement!.id,
          kind,
          fileName: originalFileName,
          storageKey: stored.key,
          mimeType: 'application/pdf',
          sizeBytes: file.size,
        },
      });
      if (kind === 'signed') {
        await tx.premiseRentalAgreement.update({
          where: { id: rental.agreement!.id },
          data: {
            status: PremiseAgreementStatus.active,
            signedAt: new Date(),
          },
        });
        await tx.premiseRental.update({
          where: { id: rental.id },
          data: {
            status: PremiseRentalStatus.active,
            confirmedByEmail: normalizeEmail(userEmail),
            confirmedAt: new Date(),
          },
        });
        await tx.premiseSlot.updateMany({
          where: { rentalId: rental.id, status: PremiseSlotStatus.pending },
          data: { status: PremiseSlotStatus.confirmed },
        });
      } else {
        await tx.premiseRentalAgreement.update({
          where: { id: rental.agreement!.id },
          data: { status: PremiseAgreementStatus.awaiting_signature },
        });
      }
    });
    return this.getRental(userId, userEmail, premiseId, rentalId);
  }

  async getRentalAgreementDocument(
    userId: string,
    userEmail: string,
    premiseId: string,
    rentalId: string,
    documentId: string,
  ) {
    await this.resolveAccess(userId, userEmail, premiseId);
    const document = await this.prisma.premiseRentalAgreementDocument.findFirst(
      {
        where: {
          id: documentId,
          agreement: { rentalId, rental: { premiseId } },
        },
      },
    );
    if (!document) throw new NotFoundException('Document not found');
    const object = await this.agreementDocuments.getObjectStream(
      document.storageKey,
    );
    return { document, object };
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
    const includesPaymentData =
      body.rentalAmountRub !== undefined || body.paymentStatus !== undefined;
    if (includesPaymentData) this.assertCanManage(access);

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
        rentalAmountKopecks:
          body.rentalAmountRub === undefined
            ? null
            : rubToKopecks(body.rentalAmountRub),
        paymentStatus: body.paymentStatus,
        contactEmail: body.contactEmail
          ? normalizeEmail(body.contactEmail)
          : email,
        contactName: body.contactName?.trim() || null,
        contactPhone: body.contactPhone?.trim() || null,
        status: access.canManage
          ? (body.status ?? PremiseSlotStatus.confirmed)
          : PremiseSlotStatus.pending,
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
    const includesPaymentData =
      body.rentalAmountRub !== undefined || body.paymentStatus !== undefined;
    if (includesPaymentData) this.assertCanManage(access);

    const startsAt = body.startsAt
      ? new Date(body.startsAt)
      : existing.startsAt;
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
    if (body.rentalAmountRub !== undefined) {
      data.rentalAmountKopecks =
        body.rentalAmountRub == null
          ? null
          : rubToKopecks(body.rentalAmountRub);
    }
    if (body.paymentStatus !== undefined) {
      data.paymentStatus = body.paymentStatus;
    }
    if (body.contactEmail !== undefined) {
      data.contactEmail =
        body.contactEmail == null ? null : normalizeEmail(body.contactEmail);
    }
    if (body.contactName !== undefined) {
      data.contactName =
        body.contactName == null
          ? null
          : String(body.contactName).trim() || null;
    }
    if (body.contactPhone !== undefined) {
      data.contactPhone =
        body.contactPhone == null
          ? null
          : String(body.contactPhone).trim() || null;
    }
    if (body.status !== undefined) {
      if (!access.canManage) {
        throw new ForbiddenException(
          'Статус брони может менять только хозяин или администратор',
        );
      }
      data.status = body.status;
    }

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
