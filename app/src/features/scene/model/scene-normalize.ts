import type { ScriptStep, TheaterLayout } from "../../../shared/types/script";
import { DEFAULT_THEATER_LAYOUT } from "./scene-slice";

export function normalizeLightChannelsFromServer(rows: unknown[]): string[] {
  const out = Array.from({ length: 8 }, () => "");
  (rows ?? []).forEach((r: unknown) => {
    const row = r as { index?: number | string; raw?: unknown };
    const idx = typeof row?.index === "number" ? row.index : Number(row?.index ?? -1);
    if (!Number.isFinite(idx) || idx < 0 || idx >= out.length) return;
    out[idx] = String(row?.raw ?? "");
  });
  return out;
}

export function normalizeLightChannelsLoose(raw: unknown): string[] {
  const out = Array.from({ length: 8 }, () => "");
  if (Array.isArray(raw)) {
    raw.forEach((r, i) => {
      if (i < 8) out[i] = String(r ?? "");
    });
  }
  return out;
}

export function normalizeTheaterLayoutFromServer(row: unknown): TheaterLayout | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const num = (v: unknown, fallback: number) =>
    v != null && Number.isFinite(Number(v)) ? Number(v) : fallback;
  const int = (v: unknown, fallback: number) =>
    v != null && Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback;
  return {
    hallWidth: int(r.hallWidth, DEFAULT_THEATER_LAYOUT.hallWidth),
    hallDepth: int(r.hallDepth, DEFAULT_THEATER_LAYOUT.hallDepth),
    wallHeight: int(r.wallHeight, DEFAULT_THEATER_LAYOUT.wallHeight),
    audienceStartZ: int(r.audienceStartZ, DEFAULT_THEATER_LAYOUT.audienceStartZ),
    seatRows: int(r.seatRows, DEFAULT_THEATER_LAYOUT.seatRows),
    seatsPerRow: int(r.seatsPerRow, DEFAULT_THEATER_LAYOUT.seatsPerRow),
    seatSpacing: num(r.seatSpacing, DEFAULT_THEATER_LAYOUT.seatSpacing),
    rowSpacing: num(r.rowSpacing, DEFAULT_THEATER_LAYOUT.rowSpacing),
    rowRise: num(r.rowRise, DEFAULT_THEATER_LAYOUT.rowRise),
    aisleWidth: num(r.aisleWidth, DEFAULT_THEATER_LAYOUT.aisleWidth),
    aisleCenterX: num(r.aisleCenterX, DEFAULT_THEATER_LAYOUT.aisleCenterX),
    doorWidth: num(r.doorWidth, DEFAULT_THEATER_LAYOUT.doorWidth),
    doorHeight: num(r.doorHeight, DEFAULT_THEATER_LAYOUT.doorHeight),
    doorZ: num(r.doorZ, DEFAULT_THEATER_LAYOUT.doorZ),
  };
}

export function extractReferencedRemoteImageKeysFromSteps(steps: ScriptStep[]): Set<string> {
  const out = new Set<string>();
  const re = /\borchestra-image:([^\s)]+)/gi;
  for (const step of steps ?? []) {
    const text = `${step.markdown ?? ""}\n${step.playMarkdown ?? ""}`;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const raw = String(m[1] ?? "").trim();
      if (!raw) continue;
      try {
        const key = decodeURIComponent(raw);
        if (key) out.add(key);
      } catch {
        // ignore
      }
    }
  }
  return out;
}
