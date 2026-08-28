import type { DialogueSceneExercise } from "./dialogue-scene-types";

export function readDoneSet(storageKey?: string): Set<string> {
  if (!storageKey) return new Set<string>();
  if (typeof window === "undefined") return new Set<string>();
  const raw = localStorage.getItem(storageKey);
  if (!raw) return new Set<string>();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map((x) => String(x ?? "")).filter(Boolean));
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { doneIds?: unknown }).doneIds)) {
      return new Set(
        (parsed as { doneIds: unknown[] }).doneIds.map((x) => String(x ?? "")).filter(Boolean),
      );
    }
    return new Set<string>();
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

export function findNextUndone(
  exercises: DialogueSceneExercise[],
  done: Set<string>,
  fromIndex: number,
): number {
  if (exercises.length === 0) return 0;
  const start = Math.max(0, Math.min(fromIndex, exercises.length - 1));
  for (let offset = 0; offset < exercises.length; offset += 1) {
    const idx = (start + offset) % exercises.length;
    const ex = exercises[idx];
    if (!done.has(ex.id)) return idx;
  }
  return start;
}
