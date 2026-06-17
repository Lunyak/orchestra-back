import type { ScriptStep, TheaterDoor, TheaterLayout } from "../../../shared/types/script";
import { normalizePersistedTheaterLayout } from "../../theater/model/theater-metrics";
import { normalizeDoors } from "../../theater/model/theater-doors";
import { mergeTheaterLayoutExtras } from "../../theater/model/theater-layout-extras";
import { resolveStepTheaterFromApi } from "../../theater/model/theater-model-serialize";
import { mapTheaterSpotlightFromApi } from "../../theater/model/theater-light-fader-bindings";
import { DEFAULT_THEATER_LAYOUT } from "./scene-slice";

export function normalizeRequisiteAssignees(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

/** Единый маппинг шага из sync API (web pull, desktop resync, prefetch). */
export function normalizeScriptStepFromSyncApi(st: unknown): ScriptStep | null {
  const row = st as Record<string, unknown> | null;
  const id = Number(row?.sourceId ?? row?.id ?? 0);
  if (!Number.isFinite(id) || id <= 0) return null;

  return {
    id,
    title: String(row?.title ?? ""),
    markdown: String(row?.markdown ?? ""),
    playMarkdown:
      typeof row?.playMarkdown === "string" ? row.playMarkdown : undefined,
    explicationMarkdown:
      typeof row?.explicationMarkdown === "string" ? row.explicationMarkdown : undefined,
    durationMin:
      row?.durationMin != null && Number.isFinite(Number(row.durationMin))
        ? Number(row.durationMin)
        : undefined,
    kanbanStatus:
      typeof row?.kanbanStatus === "string" ? row.kanbanStatus : undefined,
    kanbanOrder:
      row?.kanbanOrder != null && Number.isFinite(Number(row.kanbanOrder))
        ? Math.trunc(Number(row.kanbanOrder))
        : undefined,
    requisites: Array.isArray(row?.requisites)
      ? row.requisites.map((r: unknown) => {
          const req = r as Record<string, unknown>;
          return {
            id: Number(req?.sourceId ?? req?.id ?? 0),
            label: String(req?.label ?? ""),
            checked: Boolean(req?.checked),
            setupAssignees: normalizeRequisiteAssignees(req?.setupAssignees),
            removeAssignees: normalizeRequisiteAssignees(req?.removeAssignees),
          };
        })
      : [],
    lightPlot: Array.isArray(row?.lightPlot)
      ? row.lightPlot.map((f: unknown) => {
          const fixture = f as Record<string, unknown>;
          return {
            id: Number(fixture?.sourceId ?? fixture?.id ?? 0),
            label: String(fixture?.label ?? ""),
            channel: String(fixture?.channel ?? ""),
            x: Number(fixture?.x ?? 0),
            y: Number(fixture?.y ?? 0),
            angle:
              fixture?.angle != null && Number.isFinite(Number(fixture.angle))
                ? Number(fixture.angle)
                : undefined,
            length:
              fixture?.length != null && Number.isFinite(Number(fixture.length))
                ? Number(fixture.length)
                : undefined,
          };
        })
      : [],
    lightCues: Array.isArray(row?.lightCues)
      ? row.lightCues.map((cue: unknown) => {
          const item = cue as Record<string, unknown>;
          return {
            id: Number(item?.id ?? 0),
            tSec: Number(item?.tSec ?? 0),
            channel: String(item?.channel ?? ""),
            intensity:
              typeof item?.intensity === "number" ? item.intensity : undefined,
            enabled: item?.enabled as boolean | undefined,
          };
        })
      : undefined,
    lightKadrs:
      row?.lightKadrs && typeof row.lightKadrs === "object"
        ? (row.lightKadrs as ScriptStep["lightKadrs"])
        : undefined,
    ...resolveStepTheaterFromApi(row),
    theaterSpotlights: Array.isArray(row?.theaterSpotlights)
      ? row.theaterSpotlights
          .map((sp: unknown) => mapTheaterSpotlightFromApi(sp))
          .filter((sp): sp is NonNullable<typeof sp> => sp != null)
      : [],
  };
}

export function normalizeScriptStepsFromSyncApi(steps: unknown): ScriptStep[] {
  if (!Array.isArray(steps)) return [];
  return [...steps]
    .sort(
      (a, b) =>
        Number((a as Record<string, unknown>)?.order ?? 0) -
        Number((b as Record<string, unknown>)?.order ?? 0),
    )
    .map((st) => normalizeScriptStepFromSyncApi(st))
    .filter((step): step is ScriptStep => step != null);
}

export function normalizeLightChannelsFromServer(rows: unknown[]): string[] {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const maxIndex = normalizedRows.reduce<number>((acc, r: unknown) => {
    const row = r as { index?: number | string; raw?: unknown };
    const idx = typeof row?.index === "number" ? row.index : Number(row?.index ?? -1);
    return Number.isFinite(idx) && idx >= 0 ? Math.max(acc, Math.trunc(idx)) : acc;
  }, -1);
  const out = Array.from({ length: Math.max(8, maxIndex + 1) }, () => "");
  normalizedRows.forEach((r: unknown) => {
    const row = r as { index?: number | string; raw?: unknown };
    const idx = typeof row?.index === "number" ? row.index : Number(row?.index ?? -1);
    if (!Number.isFinite(idx) || idx < 0 || idx >= out.length) return;
    out[idx] = String(row?.raw ?? "");
  });
  return out;
}

export function normalizeLightChannelsLoose(raw: unknown): string[] {
  if (!Array.isArray(raw)) return Array.from({ length: 8 }, () => "");
  if (raw.length === 0) return Array.from({ length: 8 }, () => "");
  return Array.from({ length: raw.length }, (_, i) => String(raw[i] ?? ""));
}

export function normalizeTheaterLayoutFromServer(row: unknown): TheaterLayout | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const num = (v: unknown, fallback: number) =>
    v != null && Number.isFinite(Number(v)) ? Number(v) : fallback;
  const int = (v: unknown, fallback: number) =>
    v != null && Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback;
  const parseDoors = (raw: unknown): TheaterDoor[] | undefined => {
    if (!Array.isArray(raw)) return undefined;
    return normalizeDoors(
      raw.map((item, index) => {
        const row = item as Record<string, unknown>;
        return {
          id: int(row.id, index + 1),
          wall: String(row.wall ?? "left") as TheaterDoor["wall"],
          pos: num(row.pos, num(row.doorZ, 0)),
          width: num(row.width, num(row.doorWidth, DEFAULT_THEATER_LAYOUT.doorWidth)),
          height: num(row.height, num(row.doorHeight, DEFAULT_THEATER_LAYOUT.doorHeight)),
        };
      }),
      {
        hallWidth: num(r.hallWidth, DEFAULT_THEATER_LAYOUT.hallWidth),
        hallDepth: num(r.hallDepth, DEFAULT_THEATER_LAYOUT.hallDepth),
        wallHeight: num(r.wallHeight, DEFAULT_THEATER_LAYOUT.wallHeight),
      },
    );
  };
  return normalizePersistedTheaterLayout(
    mergeTheaterLayoutExtras(
      {
        hallWidth: num(r.hallWidth, DEFAULT_THEATER_LAYOUT.hallWidth),
        hallDepth: num(r.hallDepth, DEFAULT_THEATER_LAYOUT.hallDepth),
        wallHeight: num(r.wallHeight, DEFAULT_THEATER_LAYOUT.wallHeight),
        audienceStartZ: num(r.audienceStartZ, DEFAULT_THEATER_LAYOUT.audienceStartZ),
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
        doors: parseDoors(r.doors),
      },
      r.extras ?? r,
    ),
  );
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
