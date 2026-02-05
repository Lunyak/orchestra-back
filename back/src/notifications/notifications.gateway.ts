import { Injectable, Logger } from '@nestjs/common';
import {
    ConnectedSocket,
    MessageBody,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  private getProjectRoom(projectId: string) {
    return `project:${projectId}`;
  }

  @SubscribeMessage('join-project')
  handleJoinProject(
    @MessageBody() data: { projectId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const projectId = data?.projectId;
    if (!projectId) {
      this.logger.warn('join-project without projectId');
      return;
    }
    const room = this.getProjectRoom(projectId);
    client.join(room);
    this.logger.debug(`client ${client.id} joined ${room}`);
  }

  @SubscribeMessage('leave-project')
  handleLeaveProject(
    @MessageBody() data: { projectId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const projectId = data?.projectId;
    if (!projectId) return;
    const room = this.getProjectRoom(projectId);
    client.leave(room);
    this.logger.debug(`client ${client.id} left ${room}`);
  }

  notifySceneUpdated(projectId: string) {
    const room = this.getProjectRoom(projectId);
    this.logger.debug(`emit scene-updated to ${room}`);
    this.server.to(room).emit('scene-updated', { projectId });
  }
}

