import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl } from "../sync/api";

type ServerToClientEvents = {
  "scene-updated": (payload: { projectId?: string }) => void;
};

type ClientToServerEvents = {
  "join-project": (payload: { projectId?: string }) => void;
  "leave-project": (payload: { projectId?: string }) => void;
};

let socketSingleton:
  | Socket<ServerToClientEvents, ClientToServerEvents>
  | null = null;

function computeSocketServerUrl(): string {
  if (typeof window === "undefined") return "http://localhost:3000";

  const apiBase = String(getApiBaseUrl() ?? "");
  // If API base is absolute (e.g. http://localhost:3000), use it for socket.io too.
  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) return apiBase;

  // Otherwise (e.g. API base is /api), connect to same origin and rely on reverse proxy.
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

export function getRealtimeSocket(accessToken?: string | null) {
  if (typeof window === "undefined") return null;

  if (socketSingleton) {
    if (accessToken) {
      socketSingleton.auth = { token: accessToken };
    }
    return socketSingleton;
  }

  const url = computeSocketServerUrl();
  const socket = io(url, {
    transports: ["websocket", "polling"],
    autoConnect: false,
    auth: accessToken ? { token: accessToken } : undefined,
  });

  socketSingleton = socket as any;
  return socketSingleton;
}

export function disconnectRealtimeSocket() {
  if (!socketSingleton) return;
  try {
    socketSingleton.removeAllListeners();
    socketSingleton.disconnect();
  } finally {
    socketSingleton = null;
  }
}

