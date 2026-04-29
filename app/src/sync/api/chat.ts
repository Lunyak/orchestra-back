import { api } from "./client";

export type ChatConversationKind = "TROUPE";

export interface ChatConversationItem {
  id: string;
  kind: ChatConversationKind;
  troupeId: string | null;
  title: string;
  unreadCount?: number;
}

export interface ChatMessageItem {
  id: string;
  conversationId: string;
  authorUserId: string;
  authorEmail: string;
  body: string;
  clientMessageId: string | null;
  createdAt: string;
}

export async function fetchChatConversations(): Promise<ChatConversationItem[]> {
  const { data } = await api.get<ChatConversationItem[]>("/chat/conversations");
  return data ?? [];
}

export async function markChatConversationRead(
  conversationId: string,
  lastSeenMessageId?: string,
): Promise<{ unreadCount: number }> {
  const { data } = await api.patch<{ unreadCount: number }>(
    `/chat/conversations/${encodeURIComponent(conversationId)}/read`,
    lastSeenMessageId ? { lastSeenMessageId } : {},
  );
  return data ?? { unreadCount: 0 };
}

export async function fetchChatMessages(
  conversationId: string,
  params?: { beforeMessageId?: string; limit?: number },
): Promise<{ messages: ChatMessageItem[]; nextBeforeMessageId: string | null }> {
  const { data } = await api.get<{
    messages: ChatMessageItem[];
    nextBeforeMessageId: string | null;
  }>(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
    params: {
      beforeMessageId: params?.beforeMessageId,
      limit: params?.limit,
    },
  });
  return {
    messages: data?.messages ?? [],
    nextBeforeMessageId: data?.nextBeforeMessageId ?? null,
  };
}

export async function postChatMessage(
  conversationId: string,
  body: string,
  clientMessageId?: string,
): Promise<ChatMessageItem> {
  const { data } = await api.post<ChatMessageItem>(
    `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    { body, clientMessageId },
  );
  return data;
}
