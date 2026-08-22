import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { decryptString, encryptString } from '../crypto/secret-box';
import {
  maxGetMe,
  maxSendMessage,
  maxSubscribeWebhook,
  parseMaxInboundMessage,
} from './adapters/max.adapter';
import {
  parseVkInboundMessage,
  vkGetCallbackConfirmationCode,
  vkGetGroup,
  vkSendMessage,
} from './adapters/vk.adapter';
import { MessengerBridgeService } from './messenger-bridge.service';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function configHintFromError(e: any): string | null {
  const msg = String(e?.message ?? '');
  if (/BOT_TOKENS_KEY/i.test(msg)) {
    return 'Server is missing BOT_TOKENS_KEY (base64, 32 bytes) for token encryption.';
  }
  return null;
}

@Injectable()
export class MessengerBotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly bridge: MessengerBridgeService,
  ) {}

  async listMyChannels(userId: string) {
    const items = await this.prisma.messengerChannel.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        platform: true,
        title: true,
        status: true,
        externalBotId: true,
        externalUsername: true,
        chatId: true,
        vkGroupId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { items };
  }

  async connect(
    userId: string,
    body: {
      platform: 'max' | 'vk';
      token: string;
      title?: string;
      chatId?: string;
      vkGroupId?: string;
    },
  ) {
    const platform = body.platform;
    if (platform !== 'max' && platform !== 'vk') {
      throw new BadRequestException('platform must be max or vk');
    }
    const token = String(body.token ?? '').trim();
    if (!token) throw new BadRequestException('token is required');

    let externalBotId: string | null = null;
    let externalUsername: string | null = null;
    let title =
      String(body.title ?? '').trim() ||
      (platform === 'max' ? 'Max' : 'VK');
    let vkGroupId: string | null = null;
    let vkConfirmation: string | null = null;

    try {
      if (platform === 'max') {
        const me = await maxGetMe(token);
        externalBotId = String(me.user_id ?? '');
        externalUsername = me.username
          ? String(me.username)
          : me.name
            ? String(me.name)
            : null;
        if (!body.title?.trim() && externalUsername) {
          title = externalUsername;
        }
        if (!externalBotId) {
          throw new BadRequestException('MAX /me did not return user_id');
        }
      } else {
        const gid = String(body.vkGroupId ?? '').trim();
        if (!gid) {
          throw new BadRequestException(
            'vkGroupId is required for VKontakte (id сообщества)',
          );
        }
        const group = await vkGetGroup(token, gid);
        vkGroupId = String(group.id);
        externalBotId = `vk-${group.id}`;
        externalUsername = group.screen_name
          ? String(group.screen_name)
          : group.name
            ? String(group.name)
            : null;
        if (!body.title?.trim() && group.name) title = String(group.name);
        try {
          vkConfirmation = await vkGetCallbackConfirmationCode(token, vkGroupId);
        } catch {
          vkConfirmation = null;
        }
      }
    } catch (e: any) {
      throw new BadRequestException(
        e?.response?.data?.message ||
          e?.message ||
          `${platform} token validation failed`,
      );
    }

    let tokenEncrypted: string;
    try {
      tokenEncrypted = encryptString(token);
    } catch (e: any) {
      const hint = configHintFromError(e);
      if (hint) throw new BadRequestException(hint);
      throw e;
    }

    const webhookSecret = crypto.randomBytes(24).toString('hex');
    const chatId = String(body.chatId ?? '').trim() || null;

    try {
      const created = await this.prisma.messengerChannel.create({
        data: {
          ownerUserId: userId,
          platform,
          title,
          status: 'connected',
          tokenEncrypted,
          webhookSecret,
          externalBotId,
          externalUsername,
          chatId,
          vkGroupId,
          vkConfirmation,
        },
      });

      await this.trySetupWebhook(created.id, platform, token, webhookSecret);

      return {
        ok: true,
        id: created.id,
        platform,
        webhookHint: this.webhookHint(created.id, platform),
        vkConfirmation,
      };
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(
          'This bot/community is already connected',
        );
      }
      throw e;
    }
  }

  private webhookHint(channelId: string, platform: string) {
    const base = String(this.config.get('APP_PUBLIC_URL') ?? '').trim();
    if (!base) return null;
    const root = normalizeBaseUrl(base);
    if (platform === 'max') {
      return `${root}/messenger/max/webhook/${encodeURIComponent(channelId)}`;
    }
    if (platform === 'vk') {
      return `${root}/messenger/vk/webhook/${encodeURIComponent(channelId)}`;
    }
    return null;
  }

  private async trySetupWebhook(
    channelId: string,
    platform: string,
    token: string,
    secret: string,
  ) {
    const base = String(this.config.get('APP_PUBLIC_URL') ?? '').trim();
    if (!base || platform !== 'max') return;
    const url = `${normalizeBaseUrl(base)}/messenger/max/webhook/${encodeURIComponent(channelId)}`;
    try {
      await maxSubscribeWebhook({ token, url, secret });
    } catch {
      // webhook optional at connect time
    }
  }

  async update(
    userId: string,
    channelId: string,
    patch: {
      title?: string | null;
      status?: string;
      chatId?: string | null;
      vkConfirmation?: string | null;
    },
  ) {
    const ch = await this.requireOwned(userId, channelId);
    const item = await this.prisma.messengerChannel.update({
      where: { id: ch.id },
      data: {
        ...(patch.title !== undefined
          ? { title: patch.title?.trim() || null }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.chatId !== undefined
          ? { chatId: patch.chatId?.trim() || null }
          : {}),
        ...(patch.vkConfirmation !== undefined
          ? { vkConfirmation: patch.vkConfirmation?.trim() || null }
          : {}),
      },
      select: {
        id: true,
        platform: true,
        title: true,
        status: true,
        externalBotId: true,
        externalUsername: true,
        chatId: true,
        vkGroupId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { item };
  }

  async remove(userId: string, channelId: string) {
    await this.requireOwned(userId, channelId);
    await this.prisma.messengerChannel.delete({ where: { id: channelId } });
    return { ok: true };
  }

  async sendTestMessage(
    userId: string,
    channelId: string,
    body: { chatId?: string; text: string },
  ) {
    const ch = await this.requireOwned(userId, channelId);
    const text = String(body.text ?? '').trim();
    if (!text) throw new BadRequestException('text is required');
    const chatId = String(body.chatId ?? ch.chatId ?? '').trim();
    if (!chatId) {
      throw new BadRequestException('chatId is required');
    }
    const token = decryptString(ch.tokenEncrypted);
    try {
      if (ch.platform === 'max') {
        await maxSendMessage({ token, chatId, text });
      } else if (ch.platform === 'vk') {
        await vkSendMessage({ token, peerId: chatId, text });
      } else {
        throw new BadRequestException('unsupported platform');
      }
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'send failed');
    }
    if (!ch.chatId) {
      await this.prisma.messengerChannel.update({
        where: { id: ch.id },
        data: { chatId },
      });
    }
    return { ok: true };
  }

  async handleMaxWebhook(
    channelId: string,
    secretHeader: string | undefined,
    body: any,
  ) {
    const ch = await this.prisma.messengerChannel.findUnique({
      where: { id: channelId },
    });
    if (!ch || ch.platform !== 'max') return { ok: true };
    if (secretHeader && secretHeader !== ch.webhookSecret) {
      return { ok: false };
    }

    const inbound = parseMaxInboundMessage(body);
    if (!inbound) return { ok: true };

    await this.bridge.handleInbound({
      platform: 'max',
      sourceRef: ch.id,
      messageId: inbound.messageId,
      chatId: inbound.chatId,
      text: inbound.text,
      authorName: inbound.authorName,
      fromBot: inbound.fromBot,
    });
    return { ok: true };
  }

  async handleVkWebhook(channelId: string, body: any) {
    const ch = await this.prisma.messengerChannel.findUnique({
      where: { id: channelId },
    });
    if (!ch || ch.platform !== 'vk') return 'ok';

    const type = String(body?.type ?? '');
    if (type === 'confirmation') {
      return String(ch.vkConfirmation ?? 'ok');
    }

    const inbound = parseVkInboundMessage(body);
    if (inbound) {
      await this.bridge.handleInbound({
        platform: 'vk',
        sourceRef: ch.id,
        messageId: inbound.messageId,
        chatId: inbound.chatId,
        text: inbound.text,
        authorName: inbound.authorName,
        fromBot: inbound.fromBot,
      });
    }
    return 'ok';
  }

  private async requireOwned(userId: string, channelId: string) {
    const ch = await this.prisma.messengerChannel.findFirst({
      where: { id: channelId, ownerUserId: userId },
    });
    if (!ch) throw new NotFoundException('channel not found');
    return ch;
  }
}
