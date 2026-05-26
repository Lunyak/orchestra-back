import type { TheaterLayout } from "../../../shared/types/script";
import { normalizePersistedTheaterLayout } from "./theater-metrics";

export function theaterLayoutDraftStorageKey(projectName: string) {
  return `orchestra-theater-layout-draft:${projectName || "default"}`;
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

export function resolveInitialTheaterLayout(
  projectName: string,
  remote: TheaterLayout | null | undefined,
  fallback: TheaterLayout,
): TheaterLayout {
  const draft = readTheaterLayoutDraft(projectName);
  if (draft) return draft;
  if (remote) return normalizePersistedTheaterLayout(remote);
  return fallback;
}
