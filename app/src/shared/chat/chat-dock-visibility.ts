export const CHAT_DOCK_VISIBILITY_EVENT = "orchestra:chat-dock-visibility";
export const CHAT_DOCK_HIDDEN_STORAGE_KEY = "orchestra:chat-dock-hidden";

export function readChatDockHidden(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(CHAT_DOCK_HIDDEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function persistChatDockHidden(hidden: boolean) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(CHAT_DOCK_HIDDEN_STORAGE_KEY, String(hidden));
  } catch {
    // ignore
  }
}

export function setChatDockHidden(hidden: boolean) {
  persistChatDockHidden(hidden);
  window.dispatchEvent(
    new CustomEvent(CHAT_DOCK_VISIBILITY_EVENT, { detail: { hidden } }),
  );
}

export function toggleChatDockHidden(): boolean {
  const nextHidden = !readChatDockHidden();
  setChatDockHidden(nextHidden);
  return nextHidden;
}
