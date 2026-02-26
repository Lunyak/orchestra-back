import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { decryptString, encryptString } from '../crypto/secret-box';
import { ConnectTelegramBotDto } from './dto/connect-telegram-bot.dto';
import { UpdateTelegramBotDto } from './dto/update-telegram-bot.dto';
import { TelegramBotTestMessageDto } from './dto/test-message.dto';
import { UpsertBotVariableDto } from './dto/upsert-variable.dto';

type TelegramBotRow = {
  id: string;
  ownerUserId: string;
  botUsername: string | null;
  botTelegramUserId: string | null;
  ownerTelegramId: string | null;
  adminTelegramId: string | null;
  title: string | null;
  status: string;
  webhookSecret: string;
  groupChatId: string | null;
  attendanceThreadId: string | null;
  announcementsThreadId: string | null;
  defaultProjectSlug: string | null;
  quizGroupChatId: string | null;
  quizThreadId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type BotVariableRow = {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function validateVarKey(key: string) {
  const k = String(key ?? '').trim();
  if (!k) throw new BadRequestException('key is required');
  if (k.length > 64) throw new BadRequestException('key is too long');
  if (!/^[a-zA-Z0-9_.-]+$/.test(k)) {
    throw new BadRequestException(
      'key must match /^[a-zA-Z0-9_.-]+$/ (no spaces)',
    );
  }
  return k;
}

function renderTemplate(text: string, vars: Record<string, string>): string {
  const t = String(text ?? '');
  return t.replace(/\{\{\s*([a-zA-Z0-9_.-]{1,64})\s*\}\}/g, (_, key) => {
    const v = vars[String(key)] ?? '';
    return String(v);
  });
}

function dbHintFromError(e: any): string | null {
  const code = String(e?.code ?? '');
  const msg = String(e?.message ?? '');

  // Postgres: undefined_table / undefined_column
  if (code === '42P01' || /relation .*TelegramBotIntegration.* does not exist/i.test(msg)) {
    return 'DB is missing Telegram bot tables. Apply prisma migrations (20260220120000_telegram_bots*).';
  }
  if (code === '42703' || /column .* does not exist/i.test(msg)) {
    return 'DB schema is outdated. Apply latest prisma migrations for Telegram bot fields.';
  }
  return null;
}

function configHintFromError(e: any): string | null {
  const msg = String(e?.message ?? '');
  if (/BOT_TOKENS_KEY/i.test(msg)) {
    return 'Server is missing BOT_TOKENS_KEY (base64, 32 bytes) for token encryption.';
  }
  return null;
}

@Injectable()
export class TelegramBotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async listConnectedIntegrationsForRunner() {
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT
        "id",
        "tokenEncrypted",
        "botUsername",
        "botTelegramUserId",
        "title",
        "status",
        "ownerTelegramId",
        "adminTelegramId",
        "groupChatId",
        "attendanceThreadId",
        "announcementsThreadId",
        "defaultProjectSlug",
        "quizGroupChatId",
        "quizThreadId",
        "createdAt",
        "updatedAt"
      FROM "TelegramBotIntegration"
      WHERE "status" = 'connected'
      ORDER BY "createdAt" DESC`,
    )) as Array<TelegramBotRow & { tokenEncrypted: string }>;

    const items = rows.map((b) => {
      const enc = (b as any)?.tokenEncrypted;
      if (!enc) throw new BadRequestException('tokenEncrypted missing in DB');
      let token: string;
      try {
        token = decryptString(String(enc));
      } catch (e: any) {
        const hint = configHintFromError(e);
        if (hint) throw new BadRequestException(hint);
        throw e;
      }
      return {
        id: b.id,
        token,
        title: b.title,
        botUsername: b.botUsername,
        botTelegramUserId: b.botTelegramUserId,
        ownerTelegramId: b.ownerTelegramId,
        adminTelegramId: b.adminTelegramId,
        status: b.status,
        groupChatId: b.groupChatId,
        attendanceThreadId: b.attendanceThreadId,
        announcementsThreadId: b.announcementsThreadId,
        defaultProjectSlug: b.defaultProjectSlug,
        quizGroupChatId: b.quizGroupChatId,
        quizThreadId: b.quizThreadId,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      };
    });

    return { items };
  }

  private telegramApiBase(token: string): string {
    const t = String(token ?? '').trim();
    if (!t) throw new BadRequestException('token is required');
    return `https://api.telegram.org/bot${t}`;
  }

  private async telegramGetMe(token: string): Promise<{
    id: number;
    username?: string;
    first_name?: string;
  }> {
    try {
      const { data } = await axios.get(`${this.telegramApiBase(token)}/getMe`, {
        timeout: 10_000,
      });
      if (!data?.ok || !data?.result?.id) {
        throw new Error('getMe failed');
      }
      return data.result;
    } catch (e: any) {
      const msg =
        e?.response?.data?.description ||
        e?.message ||
        'Telegram getMe failed';
      throw new BadRequestException(msg);
    }
  }

  private async telegramSetWebhook(params: {
    token: string;
    botId: string;
    secret: string;
  }) {
    const base = String(this.config.get('APP_PUBLIC_URL') ?? '').trim();
    if (!base) return; // webhook optional
    const url = `${normalizeBaseUrl(base)}/telegram/webhook/${encodeURIComponent(params.botId)}`;
    try {
      const { data } = await axios.post(
        `${this.telegramApiBase(params.token)}/setWebhook`,
        { url, secret_token: params.secret, drop_pending_updates: true },
        { timeout: 10_000 },
      );
      if (!data?.ok) throw new Error(data?.description || 'setWebhook failed');
    } catch (e: any) {
      const msg =
        e?.response?.data?.description ||
        e?.message ||
        'Telegram setWebhook failed';
      throw new BadRequestException(msg);
    }
  }

  private async telegramDeleteWebhook(token: string) {
    try {
      await axios.post(
        `${this.telegramApiBase(token)}/deleteWebhook`,
        { drop_pending_updates: true },
        { timeout: 10_000 },
      );
    } catch (e: any) {
      const msg =
        e?.response?.data?.description ||
        e?.message ||
        'Telegram deleteWebhook failed';
      throw new BadRequestException(msg);
    }
  }

  async listMyBots(userId: string) {
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT
        "id","ownerUserId","botUsername","botTelegramUserId","title","status","webhookSecret",
        "ownerTelegramId","adminTelegramId",
        "groupChatId","attendanceThreadId","announcementsThreadId","defaultProjectSlug",
        "quizGroupChatId","quizThreadId",
        "createdAt","updatedAt"
      FROM "TelegramBotIntegration"
      WHERE "ownerUserId" = $1
      ORDER BY "createdAt" DESC`,
      userId,
    )) as TelegramBotRow[];

    return {
      items: rows.map((b) => ({
        id: b.id,
        title: b.title,
        botUsername: b.botUsername,
        botTelegramUserId: b.botTelegramUserId,
        ownerTelegramId: b.ownerTelegramId,
        adminTelegramId: b.adminTelegramId,
        status: b.status,
        groupChatId: b.groupChatId,
        attendanceThreadId: b.attendanceThreadId,
        announcementsThreadId: b.announcementsThreadId,
        defaultProjectSlug: b.defaultProjectSlug,
        quizGroupChatId: b.quizGroupChatId,
        quizThreadId: b.quizThreadId,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
    };
  }

  async connect(userId: string, dto: ConnectTelegramBotDto) {
    const token = String(dto.token ?? '').trim();
    if (!token) throw new BadRequestException('token is required');

    const me = await this.telegramGetMe(token);
    const botTelegramUserId = String(me.id);
    const botUsername = me.username ? String(me.username) : null;

    let tokenEncrypted: string;
    try {
      tokenEncrypted = encryptString(token);
    } catch (e: any) {
      const hint = configHintFromError(e);
      if (hint) throw new BadRequestException(hint);
      throw e;
    }

    const title = dto.title?.trim() || null;
    let existing: Array<{ id: string; ownerUserId: string }>;
    try {
      existing = (await this.prisma.$queryRawUnsafe(
        `SELECT "id","ownerUserId" FROM "TelegramBotIntegration"
         WHERE "botTelegramUserId" = $1
         LIMIT 1`,
        botTelegramUserId,
      )) as Array<{ id: string; ownerUserId: string }>;
    } catch (e: any) {
      const hint = dbHintFromError(e);
      if (hint) throw new BadRequestException(hint);
      throw e;
    }

    if (existing.length > 0) {
      const row = existing[0];
      if (row.ownerUserId !== userId) {
        throw new ConflictException('This Telegram bot is already connected');
      }

      // Keep previous webhookSecret
      let current: Array<{ webhookSecret: string }>;
      try {
        current = (await this.prisma.$queryRawUnsafe(
          `SELECT "webhookSecret" FROM "TelegramBotIntegration" WHERE "id" = $1`,
          row.id,
        )) as Array<{ webhookSecret: string }>;
      } catch (e: any) {
        const hint = dbHintFromError(e);
        if (hint) throw new BadRequestException(hint);
        throw e;
      }
      const webhookSecret = current[0]?.webhookSecret;
      if (!webhookSecret) throw new Error('webhookSecret missing');

      try {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "TelegramBotIntegration"
           SET "tokenEncrypted" = $1,
               "botUsername" = $2,
               "title" = COALESCE($3, "title"),
               "status" = 'connected',
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $4 AND "ownerUserId" = $5`,
          tokenEncrypted,
          botUsername,
          title,
          row.id,
          userId,
        );
      } catch (e: any) {
        const hint = dbHintFromError(e);
        if (hint) throw new BadRequestException(hint);
        throw e;
      }

      // We use long polling in bot-runner, so ensure webhook is disabled.
      await this.telegramDeleteWebhook(token);
      return { ok: true, id: row.id };
    }

    const id = crypto.randomUUID();
    const webhookSecret = crypto.randomBytes(24).toString('base64url');

    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "TelegramBotIntegration"
         ("id","ownerUserId","tokenEncrypted","botUsername","botTelegramUserId","title","status","webhookSecret","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,'connected',$7,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        id,
        userId,
        tokenEncrypted,
        botUsername,
        botTelegramUserId,
        title,
        webhookSecret,
      );
    } catch (e: any) {
      const hint = dbHintFromError(e);
      if (hint) throw new BadRequestException(hint);
      throw e;
    }

    // We use long polling in bot-runner, so ensure webhook is disabled.
    await this.telegramDeleteWebhook(token);
    return { ok: true, id };
  }

  private async assertOwner(userId: string, botId: string) {
    const got = (await this.prisma.$queryRawUnsafe(
      `SELECT "id","ownerUserId" FROM "TelegramBotIntegration" WHERE "id" = $1 LIMIT 1`,
      botId,
    )) as Array<{ id: string; ownerUserId: string }>;
    if (got.length === 0) throw new NotFoundException('Bot not found');
    if (got[0].ownerUserId !== userId) throw new ForbiddenException();
  }

  async update(userId: string, botId: string, dto: UpdateTelegramBotDto) {
    await this.assertOwner(userId, botId);

    const patch: Record<string, any> = {};
    if (dto.title !== undefined) patch.title = dto.title?.trim() || null;
    if (dto.ownerTelegramId !== undefined)
      patch.ownerTelegramId = dto.ownerTelegramId
        ? String(dto.ownerTelegramId).trim()
        : null;
    if (dto.adminTelegramId !== undefined)
      patch.adminTelegramId = dto.adminTelegramId
        ? String(dto.adminTelegramId).trim()
        : null;
    if (dto.status !== undefined) patch.status = String(dto.status ?? '').trim();
    if (dto.groupChatId !== undefined)
      patch.groupChatId = dto.groupChatId ? String(dto.groupChatId).trim() : null;
    if (dto.attendanceThreadId !== undefined)
      patch.attendanceThreadId = dto.attendanceThreadId
        ? String(dto.attendanceThreadId).trim()
        : null;
    if (dto.announcementsThreadId !== undefined)
      patch.announcementsThreadId = dto.announcementsThreadId
        ? String(dto.announcementsThreadId).trim()
        : null;
    if (dto.defaultProjectSlug !== undefined)
      patch.defaultProjectSlug = dto.defaultProjectSlug
        ? String(dto.defaultProjectSlug).trim()
        : null;
    if (dto.quizGroupChatId !== undefined)
      patch.quizGroupChatId = dto.quizGroupChatId
        ? String(dto.quizGroupChatId).trim()
        : null;
    if (dto.quizThreadId !== undefined)
      patch.quizThreadId = dto.quizThreadId
        ? String(dto.quizThreadId).trim()
        : null;

    const keys = Object.keys(patch);
    if (keys.length === 0) return { ok: true };

    const setSql = keys
      .map((k, i) => `"${k}" = $${i + 1}`)
      .concat(`"updatedAt" = CURRENT_TIMESTAMP`)
      .join(', ');
    const values = keys.map((k) => patch[k]);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "TelegramBotIntegration" SET ${setSql} WHERE "id" = $${values.length + 1} AND "ownerUserId" = $${values.length + 2}`,
      ...values,
      botId,
      userId,
    );
    return { ok: true };
  }

  async remove(userId: string, botId: string) {
    await this.assertOwner(userId, botId);
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "TelegramBotIntegration" WHERE "id" = $1 AND "ownerUserId" = $2`,
      botId,
      userId,
    );
    return { ok: true };
  }

  async listVariables(userId: string, botId: string) {
    await this.assertOwner(userId, botId);
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT v."id", v."key", v."value", v."isSecret", v."createdAt", v."updatedAt"
       FROM "BotVariable" v
       WHERE v."botId" = $1
       ORDER BY v."key" ASC`,
      botId,
    )) as BotVariableRow[];

    return {
      items: rows.map((v) => ({
        id: v.id,
        key: v.key,
        value: v.isSecret ? '' : v.value,
        isSecret: v.isSecret,
        updatedAt: v.updatedAt,
      })),
    };
  }

  async upsertVariable(
    userId: string,
    botId: string,
    keyRaw: string,
    dto: UpsertBotVariableDto,
  ) {
    await this.assertOwner(userId, botId);
    const key = validateVarKey(keyRaw);
    const value = String(dto.value ?? '');
    const isSecret = Boolean(dto.isSecret);

    const id = crypto.randomUUID();
    const rows = (await this.prisma.$queryRawUnsafe(
      `INSERT INTO "BotVariable" ("id","botId","key","value","isSecret","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("botId","key")
       DO UPDATE SET
         "value" = EXCLUDED."value",
         "isSecret" = EXCLUDED."isSecret",
         "updatedAt" = CURRENT_TIMESTAMP
       RETURNING "id","key","value","isSecret","createdAt","updatedAt"`,
      id,
      botId,
      key,
      value,
      isSecret,
    )) as BotVariableRow[];

    const v = rows[0];
    return {
      item: {
        id: v.id,
        key: v.key,
        value: v.isSecret ? '' : v.value,
        isSecret: v.isSecret,
        updatedAt: v.updatedAt,
      },
    };
  }

  async deleteVariable(userId: string, botId: string, keyRaw: string) {
    await this.assertOwner(userId, botId);
    const key = validateVarKey(keyRaw);
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "BotVariable" WHERE "botId" = $1 AND "key" = $2`,
      botId,
      key,
    );
    return { ok: true };
  }

  private async getDecryptedTokenOrThrow(userId: string, botId: string) {
    await this.assertOwner(userId, botId);
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT "tokenEncrypted" FROM "TelegramBotIntegration"
       WHERE "id" = $1 AND "ownerUserId" = $2
       LIMIT 1`,
      botId,
      userId,
    )) as Array<{ tokenEncrypted: string }>;
    const enc = rows[0]?.tokenEncrypted;
    if (!enc) throw new NotFoundException('Bot not found');
    try {
      return decryptString(enc);
    } catch (e: any) {
      const hint = configHintFromError(e);
      if (hint) throw new BadRequestException(hint);
      throw e;
    }
  }

  private async getVariablesMap(botId: string): Promise<Record<string, string>> {
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT "key","value" FROM "BotVariable" WHERE "botId" = $1`,
      botId,
    )) as Array<{ key: string; value: string }>;
    const out: Record<string, string> = {};
    rows.forEach((r) => (out[String(r.key)] = String(r.value)));
    return out;
  }

  async sendTestMessage(userId: string, botId: string, dto: TelegramBotTestMessageDto) {
    const token = await this.getDecryptedTokenOrThrow(userId, botId);
    const vars = await this.getVariablesMap(botId);
    const text = renderTemplate(dto.text, vars);
    const chatId = String(dto.chatId ?? '').trim();
    if (!chatId) throw new BadRequestException('chatId is required');

    try {
      const { data } = await axios.post(
        `${this.telegramApiBase(token)}/sendMessage`,
        { chat_id: chatId, text, parse_mode: 'HTML' },
        { timeout: 10_000 },
      );
      if (!data?.ok) throw new Error(data?.description || 'sendMessage failed');
      return { ok: true };
    } catch (e: any) {
      const msg =
        e?.response?.data?.description ||
        e?.message ||
        'Telegram sendMessage failed';
      throw new BadRequestException(msg);
    }
  }

  async validateWebhookSecret(botId: string, secret: string | null | undefined) {
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT "webhookSecret" FROM "TelegramBotIntegration" WHERE "id" = $1 LIMIT 1`,
      botId,
    )) as Array<{ webhookSecret: string }>;
    const expected = rows[0]?.webhookSecret;
    if (!expected) return false;
    return String(secret ?? '') === String(expected);
  }
}

