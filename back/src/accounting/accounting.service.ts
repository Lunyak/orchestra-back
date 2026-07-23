import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TroupeCollectionStatus } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { SetCollectionParticipantsDto } from './dto/set-collection-participants.dto';
import { SetCollectionTariffsDto } from './dto/set-collection-tariffs.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

function normalizeEmail(v: unknown): string {
  const email = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!email) throw new BadRequestException('email is required');
  return email;
}

function rubToKopecks(rub: number): number {
  if (!Number.isInteger(rub) || rub < 1) {
    throw new BadRequestException('amountRub must be a positive integer');
  }
  return rub * 100;
}

function parseOptionalDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Invalid date');
  }
  return d;
}

type CollectionAccess = {
  collection: {
    id: string;
    troupeId: string;
    troupe: { ownerUserId: string; title: string };
  };
  canView: boolean;
  canManage: boolean;
};

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  private formatRecipientName(
    email: string,
    profileByEmail: Map<string, { displayName: string | null; firstName: string | null; lastName: string | null }>,
  ): string {
    const profile = profileByEmail.get(email);
    const display = String(profile?.displayName ?? '').trim();
    if (display) return display;
    const first = String(profile?.firstName ?? '').trim();
    const last = String(profile?.lastName ?? '').trim();
    const full = `${first} ${last}`.trim();
    if (full) return full;
    return email;
  }

  private async buildProfileMap(emails: string[]) {
    const uniqueEmails = [
      ...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)),
    ];
    if (uniqueEmails.length === 0) {
      return new Map<
        string,
        {
          displayName: string | null;
          firstName: string | null;
          lastName: string | null;
        }
      >();
    }
    const profiles = await this.prisma.userProfile.findMany({
      where: { email: { in: uniqueEmails } },
      select: {
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
      },
    });
    return new Map(
      profiles.map((profile) => [
        profile.email.trim().toLowerCase(),
        {
          displayName: profile.displayName,
          firstName: profile.firstName,
          lastName: profile.lastName,
        },
      ]),
    );
  }

  private accountingAppBase(): string {
    const webDomain = String(this.config.get('WEB_DOMAIN') ?? '').trim();
    if (webDomain) {
      const host = webDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      const isLocal =
        host.startsWith('localhost') || host.startsWith('127.0.0.1');
      return `${isLocal ? 'http' : 'https'}://${host}`;
    }
    const legacy =
      this.config.get<string>('APP_FRONTEND_URL') ??
      this.config.get<string>('PASSWORD_RESET_APP_URL') ??
      this.config.get<string>('APP_PUBLIC_URL') ??
      '';
    return String(legacy).trim().replace(/\/+$/, '');
  }

  private async buildCreateContext(userId: string, userEmail: string) {
    const troupe = await this.getOrCreateMyTroupe(userId);
    const memberRows = await this.prisma.troupeMember.findMany({
      where: { troupeId: troupe.id },
      select: { email: true },
      orderBy: { createdAt: 'asc' },
    });
    const profileByEmail = await this.buildProfileMap(
      memberRows.map((row) => row.email),
    );
    const createMemberOptions = memberRows.map((row) => {
      const email = row.email.trim().toLowerCase();
      return {
        email,
        displayName: this.formatRecipientName(email, profileByEmail),
      };
    });

    const canCreateCollections = await this.isAccountantForTroupe(
      troupe.ownerUserId,
      userId,
      userEmail,
    );

    return {
      canCreateCollections,
      createMemberOptions,
      smtpConfigured: this.mailService.isSmtpConfigured(),
    };
  }

  private formatDueAtLabel(dueAt: Date | null): string | null {
    if (!dueAt) return null;
    return dueAt.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private async getOrCreateMyTroupe(userId: string) {
    const existing = await this.prisma.troupe.findUnique({
      where: { ownerUserId: userId },
    });
    if (existing) return existing;
    return await this.prisma.troupe.create({
      data: { ownerUserId: userId, title: 'Моя труппа' },
    });
  }

  async resolveAccessibleTroupeIds(userId: string, userEmail: string) {
    const email = normalizeEmail(userEmail);
    const owned = await this.prisma.troupe.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    const memberRows = await this.prisma.troupeMember.findMany({
      where: {
        OR: [{ userId }, { email }],
      },
      select: { troupeId: true },
    });
    const ids = new Set<string>();
    for (const row of memberRows) ids.add(row.troupeId);
    if (owned) ids.add(owned.id);
    return [...ids];
  }

  private async isAccountantForTroupe(
    troupeOwnerUserId: string,
    userId: string,
    userEmail: string,
  ): Promise<boolean> {
    if (troupeOwnerUserId === userId) return true;

    const email = normalizeEmail(userEmail);
    const teamMember = await this.prisma.teamMember.findUnique({
      where: {
        ownerUserId_email: { ownerUserId: troupeOwnerUserId, email },
      },
      select: {
        id: true,
        roles: true,
      },
    });
    if (!teamMember) return false;

    const roles = Array.isArray(teamMember.roles)
      ? teamMember.roles.map((r) => String(r).toLowerCase())
      : [];
    if (roles.includes('accountant')) return true;

    const accountantRole = await this.prisma.teamRoleDefinition.findFirst({
      where: {
        troupe: { ownerUserId: troupeOwnerUserId },
        slug: 'accountant',
      },
      select: { id: true },
    });
    if (!accountantRole) return false;

    const assignment = await this.prisma.teamRoleAssignment.findUnique({
      where: {
        roleId_teamMemberId: {
          roleId: accountantRole.id,
          teamMemberId: teamMember.id,
        },
      },
      select: { id: true },
    });
    return assignment != null;
  }

  private async assertUserInTroupe(
    userId: string,
    userEmail: string,
    troupeId: string,
  ) {
    const email = normalizeEmail(userEmail);
    const troupe = await this.prisma.troupe.findUnique({
      where: { id: troupeId },
      select: { id: true, ownerUserId: true },
    });
    if (!troupe) throw new NotFoundException('Troupe not found');
    if (troupe.ownerUserId === userId) return troupe;
    const member = await this.prisma.troupeMember.findFirst({
      where: {
        troupeId,
        OR: [{ userId }, { email }],
      },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Not a troupe member');
    return troupe;
  }

  private async resolveCollectionAccess(
    userId: string,
    userEmail: string,
    collectionId: string,
  ): Promise<CollectionAccess> {
    const collection = await this.prisma.troupeCollection.findUnique({
      where: { id: collectionId },
      select: {
        id: true,
        troupeId: true,
        troupe: { select: { ownerUserId: true, title: true } },
      },
    });
    if (!collection) throw new NotFoundException('Collection not found');

    const troupe = await this.assertUserInTroupe(
      userId,
      userEmail,
      collection.troupeId,
    );

    const canManage = await this.isAccountantForTroupe(
      troupe.ownerUserId,
      userId,
      userEmail,
    );

    return {
      collection,
      canView: true,
      canManage,
    };
  }

  private assertCanManage(access: CollectionAccess) {
    if (!access.canManage) {
      throw new ForbiddenException('Недостаточно прав для управления сбором');
    }
  }

  private serializeTariff(row: {
    id: string;
    title: string;
    amountKopecks: number;
    sortOrder: number;
  }) {
    return {
      id: row.id,
      title: row.title,
      amountKopecks: row.amountKopecks,
      amountRub: row.amountKopecks / 100,
      sortOrder: row.sortOrder,
    };
  }

  private serializeContribution(row: {
    id: string;
    email: string;
    amountKopecks: number;
    paidAt: Date;
    recordedByEmail: string;
    note: string | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      email: row.email,
      amountKopecks: row.amountKopecks,
      amountRub: row.amountKopecks / 100,
      paidAt: row.paidAt.toISOString(),
      recordedByEmail: row.recordedByEmail,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private buildParticipantSummary(
    participant: {
      id: string;
      email: string;
      tariff: { id: string; title: string; amountKopecks: number };
    },
    contributions: Array<{ email: string; amountKopecks: number }>,
    profileByEmail: Map<
      string,
      {
        displayName: string | null;
        firstName: string | null;
        lastName: string | null;
      }
    >,
  ) {
    const email = participant.email.trim().toLowerCase();
    const expectedKopecks = participant.tariff.amountKopecks;
    const paidKopecks = contributions
      .filter((c) => c.email === email)
      .reduce((sum, c) => sum + c.amountKopecks, 0);
    const remainingKopecks = Math.max(0, expectedKopecks - paidKopecks);
    const isPaid = paidKopecks >= expectedKopecks;

    return {
      id: participant.id,
      email,
      displayName: this.formatRecipientName(email, profileByEmail),
      tariffId: participant.tariff.id,
      tariffTitle: participant.tariff.title,
      expectedKopecks,
      expectedRub: expectedKopecks / 100,
      paidKopecks,
      paidRub: paidKopecks / 100,
      remainingKopecks,
      remainingRub: remainingKopecks / 100,
      isPaid,
    };
  }

  private async loadCollectionDetail(collectionId: string) {
    const row = await this.prisma.troupeCollection.findUnique({
      where: { id: collectionId },
      include: {
        troupe: { select: { id: true, title: true, ownerUserId: true } },
        tariffs: { orderBy: { sortOrder: 'asc' } },
        participants: {
          include: { tariff: true },
          orderBy: { email: 'asc' },
        },
        contributions: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException('Collection not found');
    return row;
  }

  private serializeCollectionSummary(
    row: {
      id: string;
      troupeId: string;
      title: string;
      description: string | null;
      status: TroupeCollectionStatus;
      dueAt: Date | null;
      premiseId: string | null;
      createdByEmail: string;
      createdAt: Date;
      updatedAt: Date;
      troupe: { id: string; title: string };
      tariffs: Array<{ amountKopecks: number }>;
      participants: Array<{
        email: string;
        tariff: { amountKopecks: number };
      }>;
      contributions: Array<{ email: string; amountKopecks: number }>;
    },
    canManage: boolean,
  ) {
    const expectedKopecks = row.participants.reduce(
      (sum, p) => sum + p.tariff.amountKopecks,
      0,
    );
    const paidKopecks = row.contributions.reduce(
      (sum, c) => sum + c.amountKopecks,
      0,
    );
    const paidParticipants = row.participants.filter((p) => {
      const paid = row.contributions
        .filter((c) => c.email === p.email)
        .reduce((s, c) => s + c.amountKopecks, 0);
      return paid >= p.tariff.amountKopecks;
    }).length;

    return {
      id: row.id,
      troupeId: row.troupeId,
      troupeTitle: row.troupe.title,
      title: row.title,
      description: row.description,
      status: row.status,
      dueAt: row.dueAt?.toISOString() ?? null,
      premiseId: row.premiseId,
      createdByEmail: row.createdByEmail,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      tariffCount: row.tariffs.length,
      participantCount: row.participants.length,
      paidParticipantCount: paidParticipants,
      expectedKopecks,
      expectedRub: expectedKopecks / 100,
      paidKopecks,
      paidRub: paidKopecks / 100,
      canManage,
    };
  }

  private async serializeCollectionDetail(
    row: Awaited<ReturnType<AccountingService['loadCollectionDetail']>>,
    canManage: boolean,
    userEmail: string,
  ) {
    const profileByEmail = await this.buildProfileMap(
      row.participants.map((participant) => participant.email),
    );
    const tariffs = row.tariffs.map((t) => this.serializeTariff(t));
    const contributions = row.contributions.map((c) =>
      this.serializeContribution(c),
    );
    const participants = row.participants.map((p) =>
      this.buildParticipantSummary(p, row.contributions, profileByEmail),
    );
    const summary = this.serializeCollectionSummary(row, canManage);
    const myEmail = normalizeEmail(userEmail);
    const myParticipant = participants.find((p) => p.email === myEmail) ?? null;
    const smtpConfigured = this.mailService.isSmtpConfigured();

    return {
      ...summary,
      tariffs,
      participants,
      contributions,
      myParticipant,
      canRecordForOthers: canManage,
      canRecordSelf: myParticipant != null,
      smtpConfigured,
      canSendReminders: canManage && smtpConfigured,
    };
  }

  async listCollections(userId: string, userEmail: string) {
    const createContext = await this.buildCreateContext(userId, userEmail);
    const troupeIds = await this.resolveAccessibleTroupeIds(userId, userEmail);
    if (troupeIds.length === 0) {
      return { collections: [], ...createContext };
    }

    const rows = await this.prisma.troupeCollection.findMany({
      where: { troupeId: { in: troupeIds } },
      include: {
        troupe: { select: { id: true, title: true, ownerUserId: true } },
        tariffs: { select: { amountKopecks: true } },
        participants: {
          include: { tariff: { select: { amountKopecks: true } } },
        },
        contributions: { select: { email: true, amountKopecks: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    const collections = await Promise.all(
      rows.map(async (row) => {
        const canManage = await this.isAccountantForTroupe(
          row.troupe.ownerUserId,
          userId,
          userEmail,
        );
        return this.serializeCollectionSummary(row, canManage);
      }),
    );

    return { collections, ...createContext };
  }

  async getCollection(userId: string, userEmail: string, collectionId: string) {
    const access = await this.resolveCollectionAccess(
      userId,
      userEmail,
      collectionId,
    );
    const row = await this.loadCollectionDetail(access.collection.id);
    return await this.serializeCollectionDetail(row, access.canManage, userEmail);
  }

  async createCollection(
    userId: string,
    userEmail: string,
    body: CreateCollectionDto,
  ) {
    const troupe = await this.getOrCreateMyTroupe(userId);
    const canManage = await this.isAccountantForTroupe(
      troupe.ownerUserId,
      userId,
      userEmail,
    );
    if (!canManage) {
      throw new ForbiddenException('Недостаточно прав для создания сбора');
    }

    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException('title is required');

    const tariffs = body.tariffs ?? [];
    if (tariffs.length === 0) {
      throw new BadRequestException('At least one tariff is required');
    }

    const participants = body.participants ?? [];
    if (participants.length === 0) {
      throw new BadRequestException('At least one participant is required');
    }

    if (body.premiseId) {
      const premise = await this.prisma.premise.findFirst({
        where: { id: body.premiseId, troupeId: troupe.id },
        select: { id: true },
      });
      if (!premise) throw new BadRequestException('Invalid premiseId');
    }

    const dueAt = parseOptionalDate(body.dueAt);
    const createdByEmail = normalizeEmail(userEmail);

    const collectionId = await this.prisma.$transaction(async (tx) => {
      const collection = await tx.troupeCollection.create({
        data: {
          troupeId: troupe.id,
          title,
          description: body.description?.trim() || null,
          dueAt,
          premiseId: body.premiseId || null,
          createdByEmail,
        },
      });

      const tariffRows = await Promise.all(
        tariffs.map((tariff, index) =>
          tx.troupeCollectionTariff.create({
            data: {
              collectionId: collection.id,
              title: String(tariff.title ?? '').trim(),
              amountKopecks: rubToKopecks(tariff.amountRub),
              sortOrder: index * 10,
            },
          }),
        ),
      );

      const participantData = participants.map((p) => {
        const email = normalizeEmail(p.email);
        const tariff = tariffRows[p.tariffIndex];
        if (!tariff) {
          throw new BadRequestException(`Invalid tariffIndex for ${email}`);
        }
        return {
          collectionId: collection.id,
          email,
          tariffId: tariff.id,
        };
      });

      await tx.troupeCollectionParticipant.createMany({
        data: participantData,
        skipDuplicates: true,
      });

      return collection.id;
    });

    return this.getCollection(userId, userEmail, collectionId);
  }

  async updateCollection(
    userId: string,
    userEmail: string,
    collectionId: string,
    body: UpdateCollectionDto,
  ) {
    const access = await this.resolveCollectionAccess(
      userId,
      userEmail,
      collectionId,
    );
    this.assertCanManage(access);

    const data: {
      title?: string;
      description?: string | null;
      status?: TroupeCollectionStatus;
      dueAt?: Date | null;
      premiseId?: string | null;
    } = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) throw new BadRequestException('title is required');
      data.title = title;
    }
    if (body.description !== undefined) {
      data.description = body.description?.trim() || null;
    }
    if (body.status !== undefined) {
      data.status = body.status as TroupeCollectionStatus;
    }
    if (body.dueAt !== undefined) {
      data.dueAt = parseOptionalDate(body.dueAt);
    }
    if (body.premiseId !== undefined) {
      if (body.premiseId) {
        const premise = await this.prisma.premise.findFirst({
          where: {
            id: body.premiseId,
            troupeId: access.collection.troupeId,
          },
          select: { id: true },
        });
        if (!premise) throw new BadRequestException('Invalid premiseId');
        data.premiseId = body.premiseId;
      } else {
        data.premiseId = null;
      }
    }

    await this.prisma.troupeCollection.update({
      where: { id: collectionId },
      data,
    });

    return this.getCollection(userId, userEmail, collectionId);
  }

  async deleteCollection(
    userId: string,
    userEmail: string,
    collectionId: string,
  ) {
    const access = await this.resolveCollectionAccess(
      userId,
      userEmail,
      collectionId,
    );
    this.assertCanManage(access);
    await this.prisma.troupeCollection.delete({ where: { id: collectionId } });
    return { ok: true };
  }

  async setTariffs(
    userId: string,
    userEmail: string,
    collectionId: string,
    body: SetCollectionTariffsDto,
  ) {
    const access = await this.resolveCollectionAccess(
      userId,
      userEmail,
      collectionId,
    );
    this.assertCanManage(access);

    const tariffs = body.tariffs ?? [];
    if (tariffs.length === 0) {
      throw new BadRequestException('At least one tariff is required');
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.troupeCollectionTariff.findMany({
        where: { collectionId },
        select: { id: true },
      });
      const keepIds = new Set(
        tariffs.map((t) => t.id).filter((id): id is string => Boolean(id)),
      );
      const removeIds = existing
        .map((t) => t.id)
        .filter((id) => !keepIds.has(id));
      if (removeIds.length > 0) {
        const used = await tx.troupeCollectionParticipant.count({
          where: { tariffId: { in: removeIds } },
        });
        if (used > 0) {
          throw new BadRequestException(
            'Нельзя удалить тариф, назначенный участникам',
          );
        }
        await tx.troupeCollectionTariff.deleteMany({
          where: { id: { in: removeIds } },
        });
      }

      for (let index = 0; index < tariffs.length; index++) {
        const tariff = tariffs[index];
        const title = String(tariff.title ?? '').trim();
        const amountKopecks = rubToKopecks(tariff.amountRub);
        if (tariff.id) {
          await tx.troupeCollectionTariff.update({
            where: { id: tariff.id },
            data: { title, amountKopecks, sortOrder: index * 10 },
          });
        } else {
          await tx.troupeCollectionTariff.create({
            data: {
              collectionId,
              title,
              amountKopecks,
              sortOrder: index * 10,
            },
          });
        }
      }
    });

    return this.getCollection(userId, userEmail, collectionId);
  }

  async setParticipants(
    userId: string,
    userEmail: string,
    collectionId: string,
    body: SetCollectionParticipantsDto,
  ) {
    const access = await this.resolveCollectionAccess(
      userId,
      userEmail,
      collectionId,
    );
    this.assertCanManage(access);

    const participants = body.participants ?? [];
    const tariffIds = new Set(
      (
        await this.prisma.troupeCollectionTariff.findMany({
          where: { collectionId },
          select: { id: true },
        })
      ).map((t) => t.id),
    );

    const normalized = participants.map((p) => {
      const email = normalizeEmail(p.email);
      if (!tariffIds.has(p.tariffId)) {
        throw new BadRequestException(`Invalid tariffId for ${email}`);
      }
      return { email, tariffId: p.tariffId };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.troupeCollectionParticipant.deleteMany({ where: { collectionId } });
      if (normalized.length > 0) {
        await tx.troupeCollectionParticipant.createMany({
          data: normalized.map((p) => ({
            collectionId,
            email: p.email,
            tariffId: p.tariffId,
          })),
        });
      }
    });

    return this.getCollection(userId, userEmail, collectionId);
  }

  async addContribution(
    userId: string,
    userEmail: string,
    collectionId: string,
    body: CreateContributionDto,
  ) {
    const access = await this.resolveCollectionAccess(
      userId,
      userEmail,
      collectionId,
    );

    const payerEmail = normalizeEmail(body.email);
    const actorEmail = normalizeEmail(userEmail);
    const isSelf = payerEmail === actorEmail;

    if (!access.canManage && !isSelf) {
      throw new ForbiddenException(
        'Можно фиксировать только свой взнос',
      );
    }

    const participant = await this.prisma.troupeCollectionParticipant.findUnique(
      {
        where: {
          collectionId_email: { collectionId, email: payerEmail },
        },
        select: { id: true },
      },
    );
    if (!participant) {
      throw new BadRequestException('Участник не включён в этот сбор');
    }

    const paidAt = parseOptionalDate(body.paidAt) ?? new Date();
    const amountKopecks = rubToKopecks(body.amountRub);

    const contribution = await this.prisma.troupeContribution.create({
      data: {
        collectionId,
        email: payerEmail,
        amountKopecks,
        paidAt,
        recordedByEmail: actorEmail,
        note: body.note?.trim() || null,
      },
    });

    return this.serializeContribution(contribution);
  }

  async removeContribution(
    userId: string,
    userEmail: string,
    collectionId: string,
    contributionId: string,
  ) {
    const access = await this.resolveCollectionAccess(
      userId,
      userEmail,
      collectionId,
    );
    this.assertCanManage(access);

    const row = await this.prisma.troupeContribution.findFirst({
      where: { id: contributionId, collectionId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Contribution not found');

    await this.prisma.troupeContribution.delete({ where: { id: contributionId } });
    return { ok: true };
  }

  async remindDebtors(
    userId: string,
    userEmail: string,
    collectionId: string,
  ) {
    const access = await this.resolveCollectionAccess(
      userId,
      userEmail,
      collectionId,
    );
    this.assertCanManage(access);

    if (!this.mailService.isSmtpConfigured()) {
      throw new ServiceUnavailableException(
        'Почта не настроена на сервере (SMTP_HOST)',
      );
    }

    const row = await this.loadCollectionDetail(collectionId);
    if (row.status === 'closed') {
      throw new BadRequestException('Сбор закрыт');
    }

    const profileByEmail = await this.buildProfileMap(
      row.participants.map((participant) => participant.email),
    );
    const appBase = this.accountingAppBase();
    const collectionUrl = appBase
      ? `${appBase}/accounting/${collectionId}`
      : `/accounting/${collectionId}`;
    const dueAtLabel = this.formatDueAtLabel(row.dueAt);

    const debtors = row.participants
      .map((participant) =>
        this.buildParticipantSummary(
          participant,
          row.contributions,
          profileByEmail,
        ),
      )
      .filter((participant) => !participant.isPaid);

    if (debtors.length === 0) {
      return { ok: true, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const debtor of debtors) {
      try {
        await this.mailService.sendCollectionDebtReminder(debtor.email, {
          recipientName: debtor.displayName,
          collectionTitle: row.title,
          troupeTitle: row.troupe.title,
          amountRub: debtor.remainingRub,
          dueAt: dueAtLabel,
          collectionUrl,
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error ? error.message : 'Не удалось отправить письмо';
        errors.push(`${debtor.email}: ${message}`);
      }
    }

    if (sent === 0 && failed > 0) {
      throw new ServiceUnavailableException(errors.join('; '));
    }

    return { ok: true, sent, failed, errors };
  }
}
