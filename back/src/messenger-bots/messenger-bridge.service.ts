import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { decryptString } from '../crypto/secret-box';
import { maxSendMessage } from './adapters/max.adapter';
import { vkSendMessage } from './adapters/vk.adapter';

export type BridgeInbound = {
  platform: 'telegram' | 'max' | 'vk';
  /** telegramBotId or messenger channel id */
  sourceRef: string;
  messageId: string;
  chatId: string;
  text: string;
  authorName: string;
  fromBot: boolean;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

@Injectable()
export class MessengerBridgeService {
  private readonly logger = new Logger(MessengerBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async handleInbound(event: BridgeInbound): Promise<{ mirrored: number }> {
    if (event.fromBot) return { mirrored: 0 };
    const text = String(event.text ?? '').trim();
    if (!text) return { mirrored: 0 };

    const members = await this.prisma.messengerBridgeMember.findMany({
      where: {
        role: 'primary',
        platform: event.platform,
        ...(event.platform === 'telegram'
          ? { telegramBotId: event.sourceRef }
          : { channelId: event.sourceRef }),
        bridge: { enabled: true },
      },
      include: {
        channel: true,
        bridge: {
          include: {
            members: {
              include: { channel: true },
            },
          },
        },
      },
    });

    let mirrored = 0;
    for (const primary of members) {
      const bridge = primary.bridge;
      if (!bridge?.enabled) continue;

      const primaryChat =
        String(primary.chatId ?? '').trim() ||
        (event.platform === 'telegram'
          ? await this.telegramGroupChatId(event.sourceRef)
          : String(primary.channel?.chatId ?? '').trim());

      if (primaryChat && primaryChat !== String(event.chatId)) {
        continue;
      }

      const mirrors = bridge.members.filter((m) => m.role === 'mirror');
      for (const mirror of mirrors) {
        try {
          const ok = await this.fanOutOne({
            bridgeId: bridge.id,
            inbound: event,
            mirror,
          });
          if (ok) mirrored += 1;
        } catch (e: any) {
          this.logger.warn(
            `bridge fan-out failed: ${e?.message || e}`,
          );
        }
      }
    }

    return { mirrored };
  }

  private async telegramGroupChatId(botId: string): Promise<string> {
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT "groupChatId" FROM "TelegramBotIntegration" WHERE "id" = $1 LIMIT 1`,
      botId,
    )) as Array<{ groupChatId: string | null }>;
    return String(rows[0]?.groupChatId ?? '').trim();
  }

  private async fanOutOne(params: {
    bridgeId: string;
    inbound: BridgeInbound;
    mirror: {
      id: string;
      platform: string;
      telegramBotId: string | null;
      channelId: string | null;
      chatId: string | null;
      channel: {
        id: string;
        platform: string;
        tokenEncrypted: string;
        chatId: string | null;
        status: string;
      } | null;
    };
  }): Promise<boolean> {
    const { bridgeId, inbound, mirror } = params;
    const targetRef =
      mirror.platform === 'telegram'
        ? String(mirror.telegramBotId ?? '')
        : String(mirror.channelId ?? '');
    if (!targetRef) return false;

    const existing = await this.prisma.mirroredMessage.findFirst({
      where: {
        bridgeId,
        sourcePlatform: inbound.platform,
        sourceMessageId: inbound.messageId,
        targetRef,
      },
    });
    if (existing) return false;

    const prefix = `[${inbound.platform}/${inbound.authorName}] `;
    const body = `${prefix}${inbound.text}`.slice(0, 3900);

    let targetMessageId = '';
    let chatId = String(mirror.chatId ?? '').trim();

    if (mirror.platform === 'telegram' && mirror.telegramBotId) {
      if (!chatId) {
        chatId = await this.telegramGroupChatId(mirror.telegramBotId);
      }
      if (!chatId) return false;
      targetMessageId = await this.sendTelegram(
        mirror.telegramBotId,
        chatId,
        body,
      );
    } else if (mirror.channel) {
      if (mirror.channel.status !== 'connected') return false;
      if (!chatId) chatId = String(mirror.channel.chatId ?? '').trim();
      if (!chatId) return false;
      const token = decryptString(mirror.channel.tokenEncrypted);
      if (mirror.platform === 'max') {
        const res = await maxSendMessage({ token, chatId, text: body });
        targetMessageId = res.messageId;
      } else if (mirror.platform === 'vk') {
        const res = await vkSendMessage({
          token,
          peerId: chatId,
          text: body,
        });
        targetMessageId = res.messageId;
      } else {
        return false;
      }
    } else {
      return false;
    }

    await this.prisma.mirroredMessage.create({
      data: {
        bridgeId,
        sourcePlatform: inbound.platform,
        sourceMessageId: inbound.messageId,
        sourceRef: inbound.sourceRef,
        targetPlatform: mirror.platform,
        targetMessageId: targetMessageId || `sent-${Date.now()}`,
        targetRef,
      },
    });
    return true;
  }

  private async sendTelegram(
    botId: string,
    chatId: string,
    text: string,
  ): Promise<string> {
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT "tokenEncrypted" FROM "TelegramBotIntegration" WHERE "id" = $1 LIMIT 1`,
      botId,
    )) as Array<{ tokenEncrypted: string }>;
    const enc = rows[0]?.tokenEncrypted;
    if (!enc) throw new BadRequestException('telegram bot not found');
    const token = decryptString(enc);
    const { data } = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: chatId, text },
      { timeout: 15_000 },
    );
    return String(data?.result?.message_id ?? '');
  }

  async listBridges(userId: string) {
    const items = await this.prisma.messengerBridge.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        members: {
          include: {
            channel: {
              select: {
                id: true,
                platform: true,
                title: true,
                externalUsername: true,
                chatId: true,
                status: true,
              },
            },
          },
        },
      },
    });
    return { items };
  }

  async createBridge(
    userId: string,
    body: {
      title?: string;
      primary: {
        platform: 'telegram' | 'max' | 'vk';
        telegramBotId?: string;
        channelId?: string;
        chatId?: string;
      };
      mirrors?: Array<{
        platform: 'telegram' | 'max' | 'vk';
        telegramBotId?: string;
        channelId?: string;
        chatId?: string;
      }>;
    },
  ) {
    this.assertMemberRef(body.primary);
    await this.assertOwnsRef(userId, body.primary);

    for (const m of body.mirrors ?? []) {
      this.assertMemberRef(m);
      await this.assertOwnsRef(userId, m);
    }

    const bridge = await this.prisma.messengerBridge.create({
      data: {
        ownerUserId: userId,
        title: body.title?.trim() || null,
        enabled: true,
        members: {
          create: [
            {
              role: 'primary',
              platform: body.primary.platform,
              telegramBotId:
                body.primary.platform === 'telegram'
                  ? body.primary.telegramBotId!
                  : null,
              channelId:
                body.primary.platform !== 'telegram'
                  ? body.primary.channelId!
                  : null,
              chatId: body.primary.chatId?.trim() || null,
            },
            ...(body.mirrors ?? []).map((m) => ({
              role: 'mirror' as const,
              platform: m.platform,
              telegramBotId:
                m.platform === 'telegram' ? m.telegramBotId! : null,
              channelId: m.platform !== 'telegram' ? m.channelId! : null,
              chatId: m.chatId?.trim() || null,
            })),
          ],
        },
      },
      include: { members: true },
    });

    return { item: bridge };
  }

  async updateBridge(
    userId: string,
    bridgeId: string,
    body: { title?: string | null; enabled?: boolean },
  ) {
    const bridge = await this.prisma.messengerBridge.findFirst({
      where: { id: bridgeId, ownerUserId: userId },
    });
    if (!bridge) throw new NotFoundException('bridge not found');

    const item = await this.prisma.messengerBridge.update({
      where: { id: bridgeId },
      data: {
        ...(body.title !== undefined
          ? { title: body.title?.trim() || null }
          : {}),
        ...(body.enabled !== undefined ? { enabled: Boolean(body.enabled) } : {}),
      },
      include: { members: true },
    });
    return { item };
  }

  async deleteBridge(userId: string, bridgeId: string) {
    const bridge = await this.prisma.messengerBridge.findFirst({
      where: { id: bridgeId, ownerUserId: userId },
    });
    if (!bridge) throw new NotFoundException('bridge not found');
    await this.prisma.messengerBridge.delete({ where: { id: bridgeId } });
    return { ok: true };
  }

  async publishText(
    userId: string,
    body: { text: string; channelIds?: string[]; telegramBotIds?: string[] },
  ) {
    const text = String(body.text ?? '').trim();
    if (!text) throw new BadRequestException('text is required');

    const results: Array<{ platform: string; ref: string; ok: boolean; error?: string }> =
      [];

    const channels = await this.prisma.messengerChannel.findMany({
      where: {
        ownerUserId: userId,
        status: 'connected',
        ...(body.channelIds?.length
          ? { id: { in: body.channelIds } }
          : {}),
      },
    });

    for (const ch of channels) {
      if (!body.channelIds?.length && !ch.chatId) continue;
      const chatId = String(ch.chatId ?? '').trim();
      if (!chatId) {
        results.push({
          platform: ch.platform,
          ref: ch.id,
          ok: false,
          error: 'chatId not set',
        });
        continue;
      }
      try {
        const token = decryptString(ch.tokenEncrypted);
        if (ch.platform === 'max') {
          await maxSendMessage({ token, chatId, text });
        } else if (ch.platform === 'vk') {
          await vkSendMessage({ token, peerId: chatId, text });
        }
        results.push({ platform: ch.platform, ref: ch.id, ok: true });
      } catch (e: any) {
        results.push({
          platform: ch.platform,
          ref: ch.id,
          ok: false,
          error: e?.message || 'send failed',
        });
      }
    }

    const tgIds = body.telegramBotIds;
    if (tgIds?.length) {
      for (const botId of tgIds) {
        try {
          const chatId = await this.telegramGroupChatId(botId);
          if (!chatId) {
            results.push({
              platform: 'telegram',
              ref: botId,
              ok: false,
              error: 'groupChatId not set',
            });
            continue;
          }
          await this.sendTelegram(botId, chatId, text);
          results.push({ platform: 'telegram', ref: botId, ok: true });
        } catch (e: any) {
          results.push({
            platform: 'telegram',
            ref: botId,
            ok: false,
            error: e?.message || 'send failed',
          });
        }
      }
    }

    return { results };
  }

  private assertMemberRef(m: {
    platform: string;
    telegramBotId?: string;
    channelId?: string;
  }) {
    if (m.platform === 'telegram') {
      if (!m.telegramBotId)
        throw new BadRequestException('telegramBotId required');
    } else if (m.platform === 'max' || m.platform === 'vk') {
      if (!m.channelId) throw new BadRequestException('channelId required');
    } else {
      throw new BadRequestException('unsupported platform');
    }
  }

  private async assertOwnsRef(
    userId: string,
    m: {
      platform: string;
      telegramBotId?: string;
      channelId?: string;
    },
  ) {
    if (m.platform === 'telegram') {
      const rows = (await this.prisma.$queryRawUnsafe(
        `SELECT "id" FROM "TelegramBotIntegration" WHERE "id" = $1 AND "ownerUserId" = $2 LIMIT 1`,
        m.telegramBotId,
        userId,
      )) as Array<{ id: string }>;
      if (!rows[0]) throw new NotFoundException('telegram bot not found');
      return;
    }
    const ch = await this.prisma.messengerChannel.findFirst({
      where: { id: m.channelId!, ownerUserId: userId },
    });
    if (!ch) throw new NotFoundException('channel not found');
  }

  publicBaseUrl(): string | null {
    const base = String(this.config.get('APP_PUBLIC_URL') ?? '').trim();
    return base ? normalizeBaseUrl(base) : null;
  }
}
