import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type { ChatConversationItem, ChatMessageItem } from "../../../sync/api/chat";

export type ChatMessagesArgs = {
  conversationId: string;
  beforeMessageId?: string;
  limit?: number;
};

export type ChatMessagesPage = {
  messages: ChatMessageItem[];
  nextBeforeMessageId: string | null;
};

export type MarkChatReadArgs = {
  conversationId: string;
  lastSeenMessageId?: string;
};

export type PostChatMessageArgs = {
  conversationId: string;
  body: string;
  clientMessageId?: string;
};

export const chatApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    chatConversations: build.query<ChatConversationItem[], void>({
      query: () => ({ url: "/chat/conversations" }),
      providesTags: (result) =>
        result
          ? [
              { type: "ChatConversation", id: "LIST" },
              ...result.map((c) => ({ type: "ChatConversation" as const, id: c.id })),
            ]
          : [{ type: "ChatConversation", id: "LIST" }],
    }),
    chatMessages: build.query<ChatMessagesPage, ChatMessagesArgs>({
      query: ({ conversationId, beforeMessageId, limit }) => ({
        url: `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
        params: { beforeMessageId, limit },
      }),
      providesTags: (_result, _err, { conversationId }) => [
        { type: "ChatMessages", id: conversationId },
      ],
    }),
    markChatConversationRead: build.mutation<{ unreadCount: number }, MarkChatReadArgs>({
      query: ({ conversationId, lastSeenMessageId }) => ({
        url: `/chat/conversations/${encodeURIComponent(conversationId)}/read`,
        method: "PATCH",
        data: lastSeenMessageId ? { lastSeenMessageId } : {},
      }),
      invalidatesTags: (_result, _err, { conversationId }) => [
        { type: "ChatConversation", id: conversationId },
        { type: "ChatConversation", id: "LIST" },
      ],
    }),
    postChatMessage: build.mutation<ChatMessageItem, PostChatMessageArgs>({
      query: ({ conversationId, body, clientMessageId }) => ({
        url: `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
        method: "POST",
        data: { body, clientMessageId },
      }),
    }),
  }),
});

export const {
  useChatConversationsQuery,
  useLazyChatMessagesQuery,
  useMarkChatConversationReadMutation,
  usePostChatMessageMutation,
} = chatApi;
