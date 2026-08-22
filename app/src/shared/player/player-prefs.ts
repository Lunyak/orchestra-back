export const PLAYER_PREFS_STORAGE_KEY = "orchestra:player-prefs";

export const PLAYER_VOLUME_CHANGE_EVENT = "orchestra:player-volume-change";

export type PlayerPrefs = {
  volume: number;
};

const DEFAULT_PREFS: PlayerPrefs = {
  volume: 0.8,
};

function clampVolume(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return DEFAULT_PREFS.volume;
  return Math.min(1, Math.max(0, parsed));
}

function parsePrefs(raw: string | null): PlayerPrefs | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PlayerPrefs>;
    return {
      volume: clampVolume(parsed.volume),
    };
  } catch {
    return null;
  }
}

export function readPlayerPrefs(): PlayerPrefs {
  try {
    if (typeof window === "undefined") return { ...DEFAULT_PREFS };

    const stored = parsePrefs(localStorage.getItem(PLAYER_PREFS_STORAGE_KEY));
    if (stored) return stored;

    return { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function persistPlayerPrefs(prefs: PlayerPrefs) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(PLAYER_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function readPlayerVolume(): number {
  return readPlayerPrefs().volume;
}

export function setPlayerVolume(volume: number) {
  const prefs = readPlayerPrefs();
  const nextVolume = clampVolume(volume);
  const next = { ...prefs, volume: nextVolume };
  persistPlayerPrefs(next);
  window.dispatchEvent(
    new CustomEvent(PLAYER_VOLUME_CHANGE_EVENT, { detail: { volume: nextVolume } }),
  );
}
