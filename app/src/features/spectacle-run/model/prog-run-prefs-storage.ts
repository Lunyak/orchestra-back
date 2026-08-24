const PROG_RUN_PAUSED_KEY_PREFIX = "orchestra-prog-run-paused:";
const PROG_RUN_KADR_STRIP_LAYOUT_KEY_PREFIX = "orchestra-prog-run-kadr-strip-layout:";
const PROG_RUN_KADR_STRIP_NOTES_OVERLAY_KEY_PREFIX =
  "orchestra-prog-run-kadr-strip-notes-overlay:";
const PROG_RUN_LIGHT_CONSOLE_OPEN_KEY_PREFIX = "orchestra-prog-run-light-console-open:";
const PROG_RUN_KADR_STRIP_PLAIN_COVER_KEY_PREFIX = "orchestra-prog-run-kadr-strip-plain-cover:";
const PROG_RUN_WIDE_LAYOUT_KEY_PREFIX = "orchestra-prog-run-wide-layout:";

export type ProgRunKadrStripLayout = "classic" | "carousel" | "flow" | "trio";

export function progRunPausedStorageKey(projectName: string): string {
  return `${PROG_RUN_PAUSED_KEY_PREFIX}${projectName}`;
}

export function progRunKadrStripLayoutStorageKey(projectName: string): string {
  return `${PROG_RUN_KADR_STRIP_LAYOUT_KEY_PREFIX}${projectName}`;
}

export function progRunKadrStripNotesOverlayStorageKey(projectName: string): string {
  return `${PROG_RUN_KADR_STRIP_NOTES_OVERLAY_KEY_PREFIX}${projectName}`;
}

export function progRunLightConsoleOpenStorageKey(projectName: string): string {
  return `${PROG_RUN_LIGHT_CONSOLE_OPEN_KEY_PREFIX}${projectName}`;
}

export function progRunKadrStripPlainCoverStorageKey(projectName: string): string {
  return `${PROG_RUN_KADR_STRIP_PLAIN_COVER_KEY_PREFIX}${projectName}`;
}

export function progRunWideLayoutStorageKey(projectName: string): string {
  return `${PROG_RUN_WIDE_LAYOUT_KEY_PREFIX}${projectName}`;
}

export function readProgRunPaused(projectName: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(progRunPausedStorageKey(projectName));
    return stored !== null ? stored === "true" : true;
  } catch {
    return true;
  }
}

export function persistProgRunPaused(projectName: string, paused: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(progRunPausedStorageKey(projectName), String(paused));
  } catch {
    // ignore
  }
}

export function readProgRunKadrStripLayout(projectName: string): ProgRunKadrStripLayout {
  if (typeof window === "undefined") return "carousel";
  try {
    const stored = localStorage.getItem(progRunKadrStripLayoutStorageKey(projectName));
    if (
      stored === "classic" ||
      stored === "carousel" ||
      stored === "flow" ||
      stored === "trio"
    ) {
      return stored;
    }
    return "carousel";
  } catch {
    return "carousel";
  }
}

export function persistProgRunKadrStripLayout(
  projectName: string,
  layout: ProgRunKadrStripLayout,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(progRunKadrStripLayoutStorageKey(projectName), layout);
  } catch {
    // ignore
  }
}

export function readProgRunKadrStripNotesOverlay(projectName: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(progRunKadrStripNotesOverlayStorageKey(projectName));
    return stored !== null ? stored === "true" : true;
  } catch {
    return true;
  }
}

export function persistProgRunKadrStripNotesOverlay(
  projectName: string,
  enabled: boolean,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      progRunKadrStripNotesOverlayStorageKey(projectName),
      String(enabled),
    );
  } catch {
    // ignore
  }
}

export function readProgRunLightConsoleOpen(projectName: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(progRunLightConsoleOpenStorageKey(projectName));
    return stored !== null ? stored === "true" : true;
  } catch {
    return true;
  }
}

export function persistProgRunLightConsoleOpen(projectName: string, open: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(progRunLightConsoleOpenStorageKey(projectName), String(open));
  } catch {
    // ignore
  }
}

export function readProgRunKadrStripPlainCover(projectName: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(progRunKadrStripPlainCoverStorageKey(projectName));
    return stored !== null ? stored === "true" : false;
  } catch {
    return false;
  }
}

export function persistProgRunKadrStripPlainCover(projectName: string, enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(progRunKadrStripPlainCoverStorageKey(projectName), String(enabled));
  } catch {
    // ignore
  }
}

export function readProgRunWideLayout(projectName: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(progRunWideLayoutStorageKey(projectName));
    return stored !== null ? stored === "true" : false;
  } catch {
    return false;
  }
}

export function persistProgRunWideLayout(projectName: string, enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(progRunWideLayoutStorageKey(projectName), String(enabled));
  } catch {
    // ignore
  }
}
