const BASE_MAX_LISTEN_MS = 45_000;
const LONG_MONOLOGUE_MAX_LISTEN_MS = 70_000;
const AUTO_RESTART_DELAY_MS = 250;
const SILENCE_STOP_MS_BASE = 1200;
const SILENCE_STOP_MS_LONG = 1700;
const RESTART_GRACE_EXTRA_MS = 300;
const INITIAL_SILENCE_MS = 4500;

function readDoneSet(storageKey?: string): Set<string> {
  if (!storageKey) return new Set<string>();
  if (typeof window === "undefined") return new Set<string>();
  const raw = localStorage.getItem(storageKey);
  if (!raw) return new Set<string>();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.map((x) => String(x ?? "")).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

function persistDoneSet(storageKey: string | undefined, next: Set<string>) {
  if (!storageKey) return;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(next.values())));
  } catch {
    // ignore
  }
}

function getSpeechRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}
