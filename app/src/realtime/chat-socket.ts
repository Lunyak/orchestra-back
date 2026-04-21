import { io, type Socket } from "socket.io-client";
import type { ChatMessageItem } from "../sync/api";
import { getApiBaseUrl } from "../sync/api";

type ServerToClientEvents = {
  "chat-message": (payload: ChatMessageItem) => void;
};

type ClientToServerEvents = {
  "join-conversation": (payload: { conversationId: string }) => void;
  "leave-conversation": (payload: { conversationId: string }) => void;
};

let chatSocketSingleton: Socket<
  ServerToClientEvents,
  ClientToServerEvents
> | null = null;

function computeChatSocketBaseUrl(): string {
  if (typeof window === "undefined") return "http://localhost:3000";

  const apiBase = String(getApiBaseUrl() ?? "");
  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    return apiBase.replace(/\/$/, "");
  }

  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

/**
 * Socket.IO namespace `/chat` (отдельно от уведомлений сценария).
 */
export function getChatSocket(accessToken?: string | null) {
  if (typeof window === "undefined") return null;

  const base = computeChatSocketBaseUrl();
  const nsUrl = `${base}/chat`;

  if (!chatSocketSingleton) {
    chatSocketSingleton = io(nsUrl, {
      transports: ["websocket", "polling"],
      autoConnect: false,
      path: "/socket.io",
      auth: accessToken ? { token: accessToken } : {},
    }) as Socket<ServerToClientEvents, ClientToServerEvents>;
  } else if (accessToken) {
    (chatSocketSingleton as any).auth = { token: accessToken };
  }

  return chatSocketSingleton;
}

export function disconnectChatSocket() {
  if (!chatSocketSingleton) return;
  try {
    chatSocketSingleton.removeAllListeners();
    chatSocketSingleton.disconnect();
  } finally {
    chatSocketSingleton = null;
  }
}
