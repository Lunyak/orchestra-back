import type { ScriptScene, TheaterDoor, TheaterLayout } from "../../../shared/types/script";
import { readLegacyPlaybookScenesArray } from "../../../shared/playbook/legacy-scene-json";
import { normalizePersistedTheaterLayout } from "../../theater/model/theater-metrics";
import { normalizeDoors } from "../../theater/model/theater-doors";
import { mergeTheaterLayoutExtras } from "../../theater/model/theater-layout-extras";
import { resolveSceneTheaterFromApi } from "../../theater/model/theater-model-serialize";
import { mapTheaterSpotlightFromApi } from "../../theater/model/theater-light-fader-bindings";
import { DEFAULT_THEATER_LAYOUT } from "./playbook-slice";

const KANBAN_STATUSES = ["raw", "text-learned", "almost-ready", "ready"] as const;

function normalizeKanbanStatus(value: unknown): ScriptScene["kanbanStatus"] {
  if (typeof value !== "string") return undefined;
  return KANBAN_STATUSES.includes(value as (typeof KANBAN_STATUSES)[number])
    ? (value as NonNullable<ScriptScene["kanbanStatus"]>)
    : undefined;
}

/** Миграция JSON playbook: legacy `steps` → `scenes`. */
export function normalizePlaybookJsonPayload(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  const scenes = readLegacyPlaybookScenesArray(data);
  const { steps: _legacySteps, ...rest } = data;
  return { ...rest, scenes };
}

/** Сцены спектакля из playbook JSON (после normalizePlaybookJsonPayload). */
export function readPlaybookScenes(data: Record<string, unknown> | null | undefined): ScriptScene[] {
  const normalized = normalizePlaybookJsonPayload(data);
  const raw = normalized.scenes;
  return Array.isArray(raw) ? (raw as ScriptScene[]) : [];
}

export function playbookSceneCount(data: Record<string, unknown> | null | undefined): number {
  return readPlaybookScenes(data).length;
}

export function normalizeRequisiteAssignees(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

/** Единый маппинг сцены из sync API (web pull, desktop resync, prefetch). */
export function normalizeScriptSceneFromSyncApi(st: unknown): ScriptScene | null {
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
    kanbanStatus: normalizeKanbanStatus(row?.kanbanStatus),
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
        ? (row.lightKadrs as ScriptScene["lightKadrs"])
        : undefined,
    ...resolveSceneTheaterFromApi(row),
    theaterSpotlights: Array.isArray(row?.theaterSpotlights)
      ? row.theaterSpotlights
          .map((sp: unknown) => mapTheaterSpotlightFromApi(sp))
          .filter((sp): sp is NonNullable<typeof sp> => sp != null)
      : [],
  };
}

export function normalizeScriptScenesFromSyncApi(scenes: unknown): ScriptScene[] {
  if (!Array.isArray(scenes)) return [];
  return [...scenes]
    .sort(
      (a, b) =>
        Number((a as Record<string, unknown>)?.order ?? 0) -
        Number((b as Record<string, unknown>)?.order ?? 0),
    )
    .map((st) => normalizeScriptSceneFromSyncApi(st))
    .filter((scene): scene is ScriptScene => scene != null);
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

export function extractReferencedRemoteImageKeysFromScenes(scenes: ScriptScene[]): Set<string> {
  const out = new Set<string>();
  const re = /\borchestra-image:([^\s)]+)/gi;
  for (const scene of scenes ?? []) {
    const text = `${scene.markdown ?? ""}\n${scene.playMarkdown ?? ""}`;
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
