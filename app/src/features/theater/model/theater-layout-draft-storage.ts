import type { TheaterLayout } from "../../../shared/types/script";
import { normalizePersistedTheaterLayout } from "./theater-metrics";

export function theaterLayoutDraftStorageKey(projectName: string) {
  return `orchestra-theater-layout-draft:${projectName || "default"}`;
}

function theaterLayoutDraftDirtyKey(projectName: string) {
  return `orchestra-theater-layout-draft-dirty:${projectName || "default"}`;
}

export function markTheaterLayoutDraftDirty(projectName: string) {
  try {
    localStorage.setItem(theaterLayoutDraftDirtyKey(projectName), "1");
  } catch {
    // ignore quota / private mode
  }
}

export function clearTheaterLayoutDraftDirty(projectName: string) {
  try {
    localStorage.removeItem(theaterLayoutDraftDirtyKey(projectName));
  } catch {
    // ignore
  }
}

export function isTheaterLayoutDraftDirty(projectName: string): boolean {
  try {
    return localStorage.getItem(theaterLayoutDraftDirtyKey(projectName)) === "1";
  } catch {
    return false;
  }
}

export function readTheaterLayoutDraft(projectName: string): TheaterLayout | null {
  try {
    const raw = localStorage.getItem(theaterLayoutDraftStorageKey(projectName));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TheaterLayout;
    if (!parsed || typeof parsed !== "object") return null;
    return normalizePersistedTheaterLayout(parsed);
  } catch {
    return null;
  }
}

export function writeTheaterLayoutDraft(projectName: string, layout: TheaterLayout) {
  try {
    localStorage.setItem(
      theaterLayoutDraftStorageKey(projectName),
      JSON.stringify(normalizePersistedTheaterLayout(layout)),
    );
  } catch {
    // ignore quota / private mode
  }
}

/** Синхронизировать черновик с сохранённой на диске/сервере версией. */
export function commitTheaterLayoutBaseline(projectName: string, layout: TheaterLayout) {
  writeTheaterLayoutDraft(projectName, layout);
  clearTheaterLayoutDraftDirty(projectName);
}

/**
 * При загрузке сцены: сервер/локальный файл — источник истины.
 * Черновик из localStorage используется только при несохранённых правках (dirty).
 */
export function resolveInitialTheaterLayout(
  projectName: string,
  remote: TheaterLayout | null | undefined,
  fallback: TheaterLayout,
): TheaterLayout {
  const remoteNorm = remote ? normalizePersistedTheaterLayout(remote) : null;
  const draft = readTheaterLayoutDraft(projectName);
  if (isTheaterLayoutDraftDirty(projectName) && draft) return draft;
  if (remoteNorm) return remoteNorm;
  if (draft) return draft;
  return fallback;
}
