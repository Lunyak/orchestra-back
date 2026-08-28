const STORAGE_KEY = "incomingInviteMailSeen";
const MAX_KEYS = 120;

export const INCOMING_INVITE_MAIL_SEEN_EVENT =
  "orchestra:incoming-invite-mail-seen";

function isKey(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function readSeenInviteMailKeys(): string[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isKey).slice(0, MAX_KEYS);
  } catch {
    return [];
  }
}

function writeSeenInviteMailKeys(keys: string[]) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys.slice(0, MAX_KEYS)));
  } catch {
    // ignore quota / private mode
  }
}

export function rememberSeenInviteMailKeys(keys: string[]): string[] {
  const incoming = keys.filter(isKey);
  if (incoming.length === 0) return readSeenInviteMailKeys();

  const previous = readSeenInviteMailKeys().filter((key) => {
    const isIncoming = incoming.includes(key);
    return !isIncoming;
  });
  const next = [...incoming, ...previous].slice(0, MAX_KEYS);
  writeSeenInviteMailKeys(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(INCOMING_INVITE_MAIL_SEEN_EVENT));
  }
  return next;
}
