import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

type SocketData = {
  userId?: string;
  userEmail?: string;
};

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    const raw =
      (client.handshake.auth as { token?: string } | undefined)?.token ??
      this.extractBearer(
        typeof client.handshake.headers.authorization === 'string'
          ? client.handshake.headers.authorization
          : undefined,
      );
    if (!raw) {
      this.logger.warn('chat connect without token');
      client.disconnect();
      return;
    }
    try {
      const secret = this.config.get<string>('JWT_SECRET');
      if (!secret) {
        this.logger.error('JWT_SECRET missing');
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify<{ sub: string; email: string }>(
        raw,
        { secret },
      );
      (client.data as SocketData).userId = payload.sub;
      (client.data as SocketData).userEmail = payload.email;

      const ids = await this.chatService.listAccessibleConversationIds(
        payload.sub,
        payload.email,
      );
      for (const conversationId of ids) {
        const room = this.chatService.roomForConversation(conversationId);
        await client.join(room);
      }
    } catch (e) {
      this.logger.warn(`chat jwt failed: ${String(e)}`);
      client.disconnect();
    }
  }

  private extractBearer(header?: string) {
    if (!header) return undefined;
    const m = /^Bearer\s+(.+)$/i.exec(header.trim());
    return m?.[1];
  }

  @SubscribeMessage('join-conversation')
  async joinConversation(
    @MessageBody() body: { conversationId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = (client.data as SocketData).userId;
    const userEmail = (client.data as SocketData).userEmail;
    const conversationId = body?.conversationId?.trim();
    if (!userId || !userEmail || !conversationId) return { ok: false };

    try {
      await this.chatService.assertConversationAccess(
        userId,
        userEmail,
        conversationId,
      );
    } catch {
      return { ok: false };
    }

    const room = this.chatService.roomForConversation(conversationId);
    await client.join(room);
    this.logger.debug(`client ${client.id} joined ${room}`);
    return { ok: true };
  }

  @SubscribeMessage('leave-conversation')
  async leaveConversation(
    @MessageBody() body: { conversationId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const conversationId = body?.conversationId?.trim();
    if (!conversationId) return { ok: false };
    const room = this.chatService.roomForConversation(conversationId);
    await client.leave(room);
    return { ok: true };
  }

  emitChatMessage(room: string, payload: unknown) {
    this.server.to(room).emit('chat-message', payload);
  }
}
