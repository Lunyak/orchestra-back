import type { VoiceExercise } from "./voice-trainer-types";

export const BASE_MAX_LISTEN_MS = 45_000;
export const LONG_MONOLOGUE_MAX_LISTEN_MS = 70_000;
export const AUTO_RESTART_DELAY_MS = 250;
export const SILENCE_STOP_MS_BASE = 1200;
export const SILENCE_STOP_MS_LONG = 1700;
export const RESTART_GRACE_EXTRA_MS = 300;
export const INITIAL_SILENCE_MS = 4500;

export function readDoneSet(storageKey?: string): Set<string> {
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

export function persistDoneSet(storageKey: string | undefined, next: Set<string>) {
  if (!storageKey) return;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(next.values())));
  } catch {
    // ignore
  }
}

export function findNextUndoneIndex(
  exercises: VoiceExercise[],
  done: Set<string>,
  fromIndex: number,
): number | null {
  if (exercises.length === 0) return null;
  const start = Math.max(0, Math.min(fromIndex, exercises.length - 1));
  for (let offset = 1; offset <= exercises.length; offset += 1) {
    const idx = (start + offset) % exercises.length;
    if (!done.has(exercises[idx]!.id)) return idx;
  }
  return null;
}
