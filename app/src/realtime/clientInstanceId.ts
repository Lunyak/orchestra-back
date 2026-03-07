const KEY = "orchestraClientInstanceId";

function fallbackId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getClientInstanceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.sessionStorage.getItem(KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : fallbackId();
    window.sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return "unknown";
  }
}

