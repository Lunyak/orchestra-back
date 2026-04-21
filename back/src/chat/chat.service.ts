import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatConversationKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PostChatMessageDto } from './dto/post-chat-message.dto';

const authorInclude = {
  select: {
    id: true,
    email: true,
  },
} as const;

function roomForConversation(conversationId: string) {
  return `conversation:${conversationId}`;
}

export type ChatMessagePayload = {
  id: string;
  conversationId: string;
  authorUserId: string;
  authorEmail: string;
  body: string;
  clientMessageId: string | null;
  createdAt: string;
};

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  roomForConversation(conversationId: string) {
    return roomForConversation(conversationId);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async resolveAccessibleTroupeIds(userId: string, userEmail: string) {
    const email = this.normalizeEmail(userEmail);
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

    // Свой чат труппы показываем только если в труппе есть хотя бы один участник
    // (иначе у «чистого» пользователя не появляется пустая «Моя труппа»).
    if (owned) {
      const n = await this.prisma.troupeMember.count({
        where: { troupeId: owned.id },
      });
      if (n > 0) ids.add(owned.id);
    }

    return [...ids];
  }

  private async assertUserInTroupe(userId: string, userEmail: string, troupeId: string) {
    const email = this.normalizeEmail(userEmail);
    const troupe = await this.prisma.troupe.findUnique({
      where: { id: troupeId },
      select: { id: true, ownerUserId: true },
    });
    if (!troupe) throw new NotFoundException('Troupe not found');
    if (troupe.ownerUserId === userId) return;
    const member = await this.prisma.troupeMember.findFirst({
      where: {
        troupeId,
        OR: [{ userId }, { email }],
      },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Not a troupe member');
  }

  async getOrCreateTroupeConversation(troupeId: string) {
    return await this.prisma.chatConversation.upsert({
      where: {
        troupeId_kind: {
          troupeId,
          kind: ChatConversationKind.TROUPE,
        },
      },
      create: {
        kind: ChatConversationKind.TROUPE,
        troupeId,
      },
      update: {},
      select: { id: true, kind: true, troupeId: true, title: true, createdAt: true },
    });
  }

  async listAccessibleConversationIds(
    userId: string,
    userEmail: string,
  ): Promise<string[]> {
    const troupeIds = await this.resolveAccessibleTroupeIds(userId, userEmail);
    const ids: string[] = [];
    for (const troupeId of troupeIds) {
      const conv = await this.getOrCreateTroupeConversation(troupeId);
      ids.push(conv.id);
    }
    return ids;
  }

  private async ensureReadBaseline(userId: string, conversationId: string) {
    const existing = await this.prisma.chatConversationReadState.findUnique({
      where: {
        userId_conversationId: { userId, conversationId },
      },
    });
    if (existing) return;

    const latest = await this.prisma.chatMessage.findFirst({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { createdAt: true },
    });
    const baseline = latest?.createdAt ?? new Date();
    await this.prisma.chatConversationReadState.create({
      data: { userId, conversationId, lastReadAt: baseline },
    });
  }

  private async countUnread(userId: string, conversationId: string) {
    const state = await this.prisma.chatConversationReadState.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });
    if (!state) return 0;
    return this.prisma.chatMessage.count({
      where: {
        conversationId,
        authorUserId: { not: userId },
        createdAt: { gt: state.lastReadAt },
      },
    });
  }

  async listConversations(userId: string, userEmail: string) {
    const troupeIds = await this.resolveAccessibleTroupeIds(userId, userEmail);
    if (!troupeIds.length) return [];

    const troupes = await this.prisma.troupe.findMany({
      where: { id: { in: troupeIds } },
      select: { id: true, title: true },
    });
    const titleById = new Map(troupes.map((t) => [t.id, t.title]));

    const out: Array<{
      id: string;
      kind: ChatConversationKind;
      troupeId: string | null;
      title: string;
      unreadCount: number;
    }> = [];

    for (const troupeId of troupeIds) {
      const conv = await this.getOrCreateTroupeConversation(troupeId);
      const troupeTitle = titleById.get(troupeId) ?? 'Труппа';
      await this.ensureReadBaseline(userId, conv.id);
      const unreadCount = await this.countUnread(userId, conv.id);
      out.push({
        id: conv.id,
        kind: conv.kind,
        troupeId: conv.troupeId,
        title: troupeTitle,
        unreadCount,
      });
    }

    return out;
  }

  async markConversationRead(
    userId: string,
    userEmail: string,
    conversationId: string,
    lastSeenMessageId?: string,
  ) {
    await this.assertConversationAccess(userId, userEmail, conversationId);

    let readAt: Date;
    if (lastSeenMessageId) {
      const msg = await this.prisma.chatMessage.findFirst({
        where: { id: lastSeenMessageId, conversationId },
        select: { createdAt: true },
      });
      if (!msg) {
        throw new BadRequestException('Сообщение не найдено в этом чате');
      }
      readAt = msg.createdAt;
    } else {
      const latest = await this.prisma.chatMessage.findFirst({
        where: { conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { createdAt: true },
      });
      readAt = latest?.createdAt ?? new Date();
    }

    const existing = await this.prisma.chatConversationReadState.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });
    const prevMs = existing?.lastReadAt?.getTime() ?? 0;
    const next = new Date(Math.max(prevMs, readAt.getTime()));

    await this.prisma.chatConversationReadState.upsert({
      where: { userId_conversationId: { userId, conversationId } },
      create: { userId, conversationId, lastReadAt: next },
      update: { lastReadAt: next },
    });

    return { unreadCount: await this.countUnread(userId, conversationId) };
  }

  async assertConversationAccess(
    userId: string,
    userEmail: string,
    conversationId: string,
  ) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, kind: true, troupeId: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.kind === ChatConversationKind.TROUPE && conv.troupeId) {
      await this.assertUserInTroupe(userId, userEmail, conv.troupeId);
      return conv;
    }
    throw new ForbiddenException('Unsupported conversation');
  }

  async listMessages(
    userId: string,
    userEmail: string,
    conversationId: string,
    limit = 20,
    beforeMessageId?: string,
  ) {
    await this.assertConversationAccess(userId, userEmail, conversationId);
    const capped = Math.min(100, Math.max(1, limit));

    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;
    if (beforeMessageId) {
      const cursorMsg = await this.prisma.chatMessage.findFirst({
        where: { id: beforeMessageId, conversationId },
      });
      if (cursorMsg) {
        cursorCreatedAt = cursorMsg.createdAt;
        cursorId = cursorMsg.id;
      }
    }

    const where: Prisma.ChatMessageWhereInput = {
      conversationId,
      ...(cursorCreatedAt && cursorId
        ? {
            OR: [
              { createdAt: { lt: cursorCreatedAt } },
              {
                createdAt: cursorCreatedAt,
                id: { lt: cursorId },
              },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.chatMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: capped + 1,
      include: { author: authorInclude },
    });

    const hasMore = rows.length > capped;
    const page = hasMore ? rows.slice(0, capped) : rows;
    const messagesAsc = page.slice().reverse();

    const nextBeforeMessageId = hasMore ? page[capped - 1]?.id ?? null : null;

    return {
      messages: messagesAsc.map((m) => this.toMessageDto(m)),
      nextBeforeMessageId,
    };
  }

  private toMessageDto(m: {
    id: string;
    conversationId: string;
    authorUserId: string;
    body: string;
    clientMessageId: string | null;
    createdAt: Date;
    author: { id: string; email: string };
  }): ChatMessagePayload {
    return {
      id: m.id,
      conversationId: m.conversationId,
      authorUserId: m.authorUserId,
      authorEmail: m.author.email,
      body: m.body,
      clientMessageId: m.clientMessageId,
      createdAt: m.createdAt.toISOString(),
    };
  }

  async postMessage(
    userId: string,
    userEmail: string,
    conversationId: string,
    dto: PostChatMessageDto,
  ): Promise<{ message: ChatMessagePayload; shouldBroadcast: boolean }> {
    await this.assertConversationAccess(userId, userEmail, conversationId);

    if (dto.clientMessageId) {
      const existing = await this.prisma.chatMessage.findFirst({
        where: {
          conversationId,
          clientMessageId: dto.clientMessageId,
        },
        include: { author: authorInclude },
      });
      if (existing) {
        return {
          message: this.toMessageDto(existing),
          shouldBroadcast: false,
        };
      }
    }

    const created = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        authorUserId: userId,
        body: dto.body,
        clientMessageId: dto.clientMessageId ?? null,
      },
      include: { author: authorInclude },
    });

    return {
      message: this.toMessageDto(created),
      shouldBroadcast: true,
    };
  }
}
