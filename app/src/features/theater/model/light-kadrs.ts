import type {
  PlaybookLightFaderV1,
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../playbook/model/playbook-slice";
import type {
  SceneLightKadrFaderStateV1,
  SceneLightKadrRequisiteActionV1,
  SceneLightKadrRequisiteCueV1,
  SceneLightKadrV1,
  SceneLightKadrsDataV1,
} from "../../../shared/types/script";
import { createId } from "../../../shared/utils/createId";
import {
  buildKadrFaderSnapshotForScene,
  buildKadrFaderSnapshotFromSofitChannels,
  resolveKadrFaderChannel,
} from "./theater-light-fader-bindings";
import type { TheaterSpotlight } from "../../../shared/types/script";
import { normalizeSelectedRecordChannels } from "../../../shared/components/light-console/light-channel-roles";

export const LIGHT_KADR_ANCHOR_RE = /<!--\s*lk:([a-zA-Z0-9_-]+)\s*-->/g;
/** Строка markdown целиком — якорь id картины (служебная, не для показа). */
export const LIGHT_KADR_ANCHOR_LINE_RE = /^\s*<!--\s*lk:([a-zA-Z0-9_-]+)\s*-->\s*$/i;

export function isLightKadrAnchorLine(line: string): boolean {
  return LIGHT_KADR_ANCHOR_LINE_RE.test(String(line ?? ""));
}

export function extractLightKadrIdFromAnchorLine(line: string): string | null {
  const m = LIGHT_KADR_ANCHOR_LINE_RE.exec(String(line ?? "").trim());
  return m?.[1] ?? null;
}
export const LIGHT_KADR_HEADING_RE = /^###\s*Картина\s+(\d+)\b/im;

export function createLightKadrId(): string {
  return createId();
}

export function normalizeLightKadrs(
  raw: SceneLightKadrsDataV1 | SceneLightKadrV1[] | null | undefined,
): SceneLightKadrsDataV1 {
  const list = Array.isArray(raw)
    ? raw
    : raw && raw.v === 1 && Array.isArray(raw.kadrs)
      ? raw.kadrs
      : [];
  const kadrs = list
    .map((item) => normalizeLightKadr(item))
    .filter((item): item is SceneLightKadrV1 => item != null);
  return { v: 1, kadrs };
}

export function readSceneLightKadrs(
  scene: { lightKadrs?: SceneLightKadrsDataV1 | null } | null | undefined,
): SceneLightKadrsDataV1 {
  return normalizeLightKadrs(scene?.lightKadrs ?? null);
}

/** Одна строка на пару K+F; при дублях в старых кадрах — оставляем последнюю. */
export function dedupeKadrFaderStates(
  rows: SceneLightKadrFaderStateV1[],
): SceneLightKadrFaderStateV1[] {
  const byKey = new Map<string, SceneLightKadrFaderStateV1>();
  for (const row of rows) {
    if (row.faderId <= 0) continue;
    const ch =
      row.channel != null && Number.isFinite(row.channel) && row.channel > 0
        ? Math.trunc(row.channel)
        : 0;
    const key = `${ch}:${row.faderId}`;
    byKey.set(key, {
      ...row,
      faderId: row.faderId,
      ...(ch > 0 ? { channel: ch } : {}),
    });
  }
  return [...byKey.values()].sort(
    (a, b) =>
      (a.channel ?? 0) - (b.channel ?? 0) || a.faderId - b.faderId,
  );
}

function normalizePositiveIdList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .map((id) => Math.trunc(Number(id) || 0))
        .filter((id) => id > 0),
    ),
  ];
}

function normalizeKadrSound(
  raw: SceneLightKadrV1["sound"] | null | undefined,
): SceneLightKadrV1["sound"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const playTrackIds = normalizePositiveIdList(raw.playTrackIds);
  const soundIds = normalizePositiveIdList(raw.soundIds);
  const volume =
    typeof raw.volume === "number" && Number.isFinite(raw.volume)
      ? Math.min(1, Math.max(0, raw.volume))
      : undefined;
  const fadeMs =
    typeof raw.fadeMs === "number" && Number.isFinite(raw.fadeMs) && raw.fadeMs > 0
      ? Math.round(raw.fadeMs)
      : undefined;
  if (playTrackIds.length === 0 && soundIds.length === 0 && volume == null && fadeMs == null) {
    return undefined;
  }
  return {
    ...(playTrackIds.length > 0 ? { playTrackIds } : {}),
    ...(soundIds.length > 0 ? { soundIds } : {}),
    ...(volume != null ? { volume } : {}),
    ...(fadeMs != null ? { fadeMs } : {}),
  };
}

function normalizeKadrProjector(
  raw: SceneLightKadrV1["projector"] | null | undefined,
): SceneLightKadrV1["projector"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  if (raw.mode === "video") {
    const videoId = Math.trunc(Number(raw.videoId) || 0);
    if (videoId <= 0) return undefined;
    return raw.muted === true
      ? { mode: "video", videoId, muted: true }
      : { mode: "video", videoId };
  }
  if (raw.mode === "hold") {
    const holdId = Math.trunc(Number(raw.holdId) || 0);
    return holdId > 0 ? { mode: "hold", holdId } : { mode: "hold" };
  }
  return undefined;
}

function normalizeOptionalPositiveSec(raw: unknown): number | undefined {
  const n = Math.trunc(Number(raw) || 0);
  return n > 0 ? n : undefined;
}

const KADR_REQUISITE_ACTIONS: ReadonlySet<SceneLightKadrRequisiteActionV1> = new Set([
  "setup",
  "strike",
  "use",
]);

function normalizeKadrRequisites(
  raw: SceneLightKadrV1["requisites"] | null | undefined,
): SceneLightKadrRequisiteCueV1[] {
  if (!Array.isArray(raw)) return [];
  const out: SceneLightKadrRequisiteCueV1[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const requisiteId = Math.trunc(Number(item.requisiteId) || 0);
    const action = item.action as SceneLightKadrRequisiteActionV1;
    if (requisiteId <= 0 || !KADR_REQUISITE_ACTIONS.has(action)) continue;
    const key = `${requisiteId}:${action}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ requisiteId, action });
  }
  return out;
}

function normalizeLightKadr(raw: Partial<SceneLightKadrV1> | null | undefined): SceneLightKadrV1 | null {
  if (!raw || typeof raw.id !== "string" || !raw.id.trim()) return null;
  const kadrNo = Math.max(1, Math.trunc(Number(raw.kadrNo) || 1));
  const programId = Math.max(0, Math.trunc(Number(raw.programId) || 0));
  const faders = dedupeKadrFaderStates(
    Array.isArray(raw.faders)
      ? raw.faders
          .map((f) => ({
            faderId: Math.max(1, Math.trunc(Number(f.faderId) || 0)),
            channel:
              f.channel != null && Number.isFinite(Number(f.channel)) && Number(f.channel) > 0
                ? Math.trunc(Number(f.channel))
                : undefined,
            intensity:
              typeof f.intensity === "number" && Number.isFinite(f.intensity)
                ? Math.min(1, Math.max(0, f.intensity))
                : undefined,
            enabled: f.enabled,
          }))
          .filter((f) => f.faderId > 0)
      : [],
  );
  const recordChannels = normalizeSelectedRecordChannels(
    Array.isArray(raw.recordChannels) ? raw.recordChannels : undefined,
    64,
  );
  const sound = normalizeKadrSound(raw.sound);
  const projector = normalizeKadrProjector(raw.projector);
  const requisites = normalizeKadrRequisites(raw.requisites);
  const transitionText =
    typeof raw.transitionText === "string" ? raw.transitionText.trim() || undefined : undefined;
  const commentText =
    typeof raw.commentText === "string"
      ? raw.commentText.trim() || undefined
      : typeof raw.note === "string"
        ? raw.note.trim() || undefined
        : undefined;
  const imageMarkdown =
    typeof raw.imageMarkdown === "string" ? raw.imageMarkdown.trim() || undefined : undefined;
  const blackoutDurationSec = normalizeOptionalPositiveSec(raw.blackoutDurationSec);
  const smokeDurationSec = normalizeOptionalPositiveSec(raw.smokeDurationSec);
  return {
    id: raw.id.trim(),
    kadrNo,
    title: typeof raw.title === "string" ? raw.title.trim() || undefined : undefined,
    programId,
    faders,
    ...(recordChannels.length > 0 ? { recordChannels } : {}),
    nextProgramId:
      raw.nextProgramId != null && Number.isFinite(Number(raw.nextProgramId))
        ? Math.max(1, Math.trunc(Number(raw.nextProgramId)))
        : undefined,
    blackout: raw.blackout === true,
    smokeMachine: raw.smokeMachine === true ? true : undefined,
    ...(sound ? { sound } : {}),
    ...(projector ? { projector } : {}),
    ...(requisites.length > 0 ? { requisites } : {}),
    ...(transitionText ? { transitionText } : {}),
    ...(commentText ? { commentText } : {}),
    ...(blackoutDurationSec != null ? { blackoutDurationSec } : {}),
    ...(smokeDurationSec != null ? { smokeDurationSec } : {}),
    ...(imageMarkdown ? { imageMarkdown } : {}),
    note: typeof raw.note === "string" ? raw.note.trim() || undefined : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

export type MarkdownKadrSection = {
  kadrNo: number;
  id: string | null;
  headingStart: number;
  headingEnd: number;
  sectionEnd: number;
  headingTitle: string;
};

export function scanMarkdownKadrSections(markdown: string): MarkdownKadrSection[] {
  const text = String(markdown ?? "");
  const headingRe = /^###\s*Картина\s+(\d+)\b[^\n]*/gim;
  const matches: MarkdownKadrSection[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(text)) !== null) {
    const kadrNo = Math.max(1, Math.trunc(Number(match[1]) || 1));
    const headingStart = match.index;
    const headingEnd = headingStart + match[0].length;
    const afterHeading = text.slice(headingEnd, headingEnd + 120);
    const anchorMatch = afterHeading.match(/^\s*\n\s*<!--\s*lk:([a-zA-Z0-9_-]+)\s*-->/);
    const id = anchorMatch?.[1] ?? null;
    matches.push({
      kadrNo,
      id,
      headingStart,
      headingEnd: anchorMatch ? headingEnd + anchorMatch[0].length : headingEnd,
      sectionEnd: text.length,
      headingTitle: match[0].replace(/^###\s*/i, "").trim(),
    });
  }
  for (let i = 0; i < matches.length; i += 1) {
    const next = matches[i + 1];
    matches[i].sectionEnd = next ? next.headingStart : text.length;
  }
  return matches;
}

export function nextKadrNumberForScene(
  scene: {
    lightKadrs?: SceneLightKadrsDataV1 | null;
    /** Только для нумерации legacy-вставок в текст; JSON — SoT. */
    markdown?: string | null;
  } | null | undefined,
): number {
  const kadrs = readSceneLightKadrs(scene);
  const fromKadrs =
    kadrs.kadrs.length > 0 ? Math.max(...kadrs.kadrs.map((k) => k.kadrNo)) : 0;
  const sections = scanMarkdownKadrSections(String(scene?.markdown ?? ""));
  const fromMarkdown =
    sections.length > 0 ? Math.max(...sections.map((s) => s.kadrNo)) : 0;
  return Math.max(fromKadrs, fromMarkdown, 0) + 1;
}

/** Перенумеровать картины в JSON подряд: 1…N по текущему порядку. */
export function renumberSceneLightKadrs(kadrs: SceneLightKadrsDataV1): SceneLightKadrsDataV1 {
  const sorted = [...kadrs.kadrs].sort(
    (a, b) => a.kadrNo - b.kadrNo || a.id.localeCompare(b.id),
  );
  return {
    v: 1,
    kadrs: sorted.map((kadr, index) => ({
      ...kadr,
      kadrNo: index + 1,
    })),
  };
}

/** Удалить картину из JSON и перенумеровать. */
export function deleteKadrFromSceneData(
  scene: { lightKadrs?: SceneLightKadrsDataV1 | null } | null | undefined,
  target: { id?: string | null; kadrNo?: number },
): SceneLightKadrsDataV1 {
  const kadrs = readSceneLightKadrs(scene);
  const filtered = kadrs.kadrs.filter((kadr) => {
    if (target.id && kadr.id === target.id) return false;
    if (!target.id && target.kadrNo != null && kadr.kadrNo === target.kadrNo) return false;
    return true;
  });
  return renumberSceneLightKadrs({ v: 1, kadrs: filtered });
}

/** Найти секцию картины в актуальном markdown (для ленты спектакля / записи). */
export function resolveKadrSectionForTapeItem(
  markdown: string,
  item: {
    kadrId: string | null;
    kadrNo: number;
    section?: MarkdownKadrSection | null;
  },
): MarkdownKadrSection | null {
  const text = String(markdown ?? "");
  const resolved =
    findKadrSectionInMarkdown(text, {
      id: item.kadrId,
      kadrNo: item.kadrNo,
      headingStart: item.section?.headingStart,
    }) ??
    (item.kadrId
      ? scanMarkdownKadrSections(text).find((s) => s.id === item.kadrId) ?? null
      : null);
  return resolved ?? item.section ?? null;
}

export function findKadrSectionInMarkdown(
  markdown: string,
  target: { id?: string | null; kadrNo?: number; headingStart?: number },
): MarkdownKadrSection | null {
  const sections = scanMarkdownKadrSections(markdown);
  if (sections.length === 0) return null;
  if (target.id) {
    const byId = sections.find((s) => s.id === target.id);
    if (byId) return byId;
  }
  if (target.headingStart != null) {
    const byPos = sections.find((s) => s.headingStart === target.headingStart);
    if (byPos) return byPos;
  }
  if (target.kadrNo != null && target.kadrNo > 0) {
    const byNo = sections.filter((s) => s.kadrNo === target.kadrNo);
    if (byNo.length === 1) return byNo[0];
  }
  return null;
}


export function findKadrSectionAtOffset(
  markdown: string,
  offset: number,
): MarkdownKadrSection | null {
  const sections = scanMarkdownKadrSections(markdown);
  if (sections.length === 0) return null;
  const pos = Math.max(0, Math.trunc(offset));
  for (let i = sections.length - 1; i >= 0; i -= 1) {
    if (pos >= sections[i].headingStart) return sections[i];
  }
  return null;
}

export function findKadrById(
  kadrs: SceneLightKadrsDataV1,
  id: string,
): SceneLightKadrV1 | undefined {
  return kadrs.kadrs.find((k) => k.id === id);
}

export function buildKadrFaderSnapshot(faders: PlaybookLightFadersDataV1): SceneLightKadrV1["faders"] {
  return faders.faders.map((fader) => ({
    faderId: fader.id,
    intensity: fader.intensity ?? 1,
    enabled: fader.enabled ?? true,
  }));
}

export function buildKadrFromConsole(args: {
  id: string;
  kadrNo: number;
  title?: string;
  programId: number;
  faders: PlaybookLightFadersDataV1;
  spotlights?: TheaterSpotlight[];
  lightPrograms?: PlaybookLightProgramsDataV1 | null;
  sofitChannels?: number[];
  liveConsoleChannel?: number;
  lightChannelsCount?: number;
  nextProgramId?: number;
  blackout?: boolean;
  note?: string;
}): SceneLightKadrV1 {
  const liveCh = Math.max(1, Math.trunc(args.liveConsoleChannel ?? 1) || 1);
  const faderStates = dedupeKadrFaderStates(
    args.lightPrograms && args.sofitChannels?.length
      ? buildKadrFaderSnapshotFromSofitChannels({
          baseFaders: args.faders,
          programs: args.lightPrograms,
          sofitChannels: args.sofitChannels,
          liveChannel: liveCh,
          liveFaders: args.faders,
          lightChannelsCount: args.lightChannelsCount,
          spotlights: args.spotlights ?? [],
        })
      : args.spotlights != null
        ? buildKadrFaderSnapshotForScene(args.faders, args.spotlights, liveCh)
        : buildKadrFaderSnapshot(args.faders).map((row) => ({
            ...row,
            channel: liveCh,
          })),
  );
  const recordChannels = normalizeSelectedRecordChannels(
    args.sofitChannels,
    args.lightChannelsCount ?? 64,
  );
  return {
    id: args.id,
    kadrNo: args.kadrNo,
    title: args.title,
    programId: args.programId,
    faders: faderStates,
    ...(recordChannels.length > 0 ? { recordChannels } : {}),
    nextProgramId: args.nextProgramId,
    blackout: args.blackout,
    note: args.note,
    updatedAt: new Date().toISOString(),
  };
}

export function upsertKadrInScene(args: {
  kadrs: SceneLightKadrsDataV1;
  kadr: SceneLightKadrV1;
}): SceneLightKadrsDataV1 {
  const next = args.kadrs.kadrs.filter((k) => k.id !== args.kadr.id);
  next.push(args.kadr);
  next.sort((a, b) => a.kadrNo - b.kadrNo || a.id.localeCompare(b.id));
  return { v: 1, kadrs: next };
}

export function applyKadrToFaders(
  kadr: SceneLightKadrV1,
  faders: PlaybookLightFadersDataV1,
): PlaybookLightFadersDataV1 {
  const stateByFader = new Map(kadr.faders.map((f) => [f.faderId, f]));
  return {
    ...faders,
    faders: faders.faders.map((fader) => {
      const state = stateByFader.get(fader.id);
      if (!state) return fader;
      return {
        ...fader,
        intensity: state.intensity ?? fader.intensity,
        enabled: state.enabled ?? fader.enabled,
      };
    }),
  };
}

export function lightKadrsStableKey(data: SceneLightKadrsDataV1 | null | undefined): string {
  const kadrs = normalizeLightKadrs(data).kadrs;
  return JSON.stringify(
    kadrs.map((k) => ({
      id: k.id,
      kadrNo: k.kadrNo,
      title: k.title ?? null,
      programId: k.programId,
      faders: k.faders,
      recordChannels: k.recordChannels ?? null,
      nextProgramId: k.nextProgramId ?? null,
      blackout: k.blackout ?? false,
      smokeMachine: k.smokeMachine ?? false,
      sound: k.sound ?? null,
      projector: k.projector ?? null,
      transitionText: k.transitionText ?? null,
      commentText: k.commentText ?? null,
      blackoutDurationSec: k.blackoutDurationSec ?? null,
      smokeDurationSec: k.smokeDurationSec ?? null,
      imageMarkdown: k.imageMarkdown ?? null,
      note: k.note ?? null,
    })),
  );
}

export function formatDeleteKadrConfirmMessage(headingTitle: string): string {
  const label = String(headingTitle ?? "").trim() || "картину";
  return `Удалить «${label}»?\n\nОстальные картины в сцене будут перенумерованы (1, 2, 3…).`;
}

export function fadersForKadrDisplay(
  kadr: SceneLightKadrV1,
  baseFaders: PlaybookLightFadersDataV1,
): PlaybookLightFadersDataV1 {
  return applyKadrToFaders(kadr, baseFaders);
}

export type LightKadrFaderDef = PlaybookLightFaderV1;
