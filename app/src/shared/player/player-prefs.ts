export const PLAYER_PREFS_STORAGE_KEY = "orchestra:player-prefs";
const PLAYER_DOCK_HIDDEN_LEGACY_KEY = "orchestra:player-dock-hidden";

export const PLAYER_DOCK_VISIBILITY_EVENT = "orchestra:player-dock-visibility";
export const PLAYER_VOLUME_CHANGE_EVENT = "orchestra:player-volume-change";
export const PLAYER_DOCK_OFFSET_CHANGE_EVENT = "orchestra:player-dock-offset-change";

export type PlayerDockOffset = {
  x: number;
  y: number;
};

export type PlayerPrefs = {
  dockHidden: boolean;
  volume: number;
  dockOffset?: PlayerDockOffset;
};

const DEFAULT_DOCK_OFFSET: PlayerDockOffset = { x: 0, y: 0 };

const DEFAULT_PREFS: PlayerPrefs = {
  dockHidden: false,
  volume: 0.8,
  dockOffset: DEFAULT_DOCK_OFFSET,
};

function clampVolume(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return DEFAULT_PREFS.volume;
  return Math.min(1, Math.max(0, parsed));
}

function clampDockAxis(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function parseDockOffset(raw: Partial<PlayerPrefs>): PlayerDockOffset {
  const offset = raw.dockOffset;
  if (!offset || typeof offset !== "object") return { ...DEFAULT_DOCK_OFFSET };
  return {
    x: clampDockAxis(offset.x),
    y: clampDockAxis(offset.y),
  };
}

function parsePrefs(raw: string | null): PlayerPrefs | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PlayerPrefs>;
    return {
      dockHidden: parsed.dockHidden === true,
      volume: clampVolume(parsed.volume),
      dockOffset: parseDockOffset(parsed),
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

    const legacyHidden =
      localStorage.getItem(PLAYER_DOCK_HIDDEN_LEGACY_KEY) === "true";
    const migrated: PlayerPrefs = {
      ...DEFAULT_PREFS,
      dockHidden: legacyHidden,
    };
    persistPlayerPrefs(migrated);
    localStorage.removeItem(PLAYER_DOCK_HIDDEN_LEGACY_KEY);
    return migrated;
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

export function readPlayerDockHidden(): boolean {
  return readPlayerPrefs().dockHidden;
}

export function readPlayerVolume(): number {
  return readPlayerPrefs().volume;
}

export function readPlayerDockOffset(): PlayerDockOffset {
  return readPlayerPrefs().dockOffset ?? { ...DEFAULT_DOCK_OFFSET };
}

export function setPlayerDockOffset(offset: PlayerDockOffset) {
  const prefs = readPlayerPrefs();
  const nextOffset = {
    x: clampDockAxis(offset.x),
    y: clampDockAxis(offset.y),
  };
  const next = { ...prefs, dockOffset: nextOffset };
  persistPlayerPrefs(next);
  window.dispatchEvent(
    new CustomEvent(PLAYER_DOCK_OFFSET_CHANGE_EVENT, { detail: { offset: nextOffset } }),
  );
}

export function resetPlayerDockOffset() {
  setPlayerDockOffset(DEFAULT_DOCK_OFFSET);
}

export function setPlayerDockHidden(hidden: boolean) {
  const prefs = readPlayerPrefs();
  const next = { ...prefs, dockHidden: hidden };
  persistPlayerPrefs(next);
  window.dispatchEvent(
    new CustomEvent(PLAYER_DOCK_VISIBILITY_EVENT, { detail: { hidden } }),
  );
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

export function togglePlayerDockHidden(): boolean {
  const nextHidden = !readPlayerDockHidden();
  setPlayerDockHidden(nextHidden);
  return nextHidden;
}
