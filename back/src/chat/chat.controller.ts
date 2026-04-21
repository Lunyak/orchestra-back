import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { MarkChatReadDto } from './dto/mark-chat-read.dto';
import { PostChatMessageDto } from './dto/post-chat-message.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('conversations')
  listConversations(@Req() req: any) {
    return this.chatService.listConversations(
      req.user.userId,
      req.user.email,
    );
  }

  @Patch('conversations/:conversationId/read')
  markRead(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Body() body: MarkChatReadDto,
  ) {
    return this.chatService.markConversationRead(
      req.user.userId,
      req.user.email,
      conversationId,
      body?.lastSeenMessageId,
    );
  }

  @Get('conversations/:conversationId/messages')
  listMessages(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.chatService.listMessages(
      req.user.userId,
      req.user.email,
      conversationId,
      query.limit,
      query.beforeMessageId,
    );
  }

  @Post('conversations/:conversationId/messages')
  async postMessage(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Body() body: PostChatMessageDto,
  ) {
    const { message, shouldBroadcast } = await this.chatService.postMessage(
      req.user.userId,
      req.user.email,
      conversationId,
      body,
    );
    if (shouldBroadcast) {
      this.chatGateway.emitChatMessage(
        this.chatService.roomForConversation(conversationId),
        message,
      );
    }
    return message;
  }
}
