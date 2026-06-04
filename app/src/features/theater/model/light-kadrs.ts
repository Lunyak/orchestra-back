import type {
  SceneLightFaderV1,
  SceneLightFadersDataV1,
  SceneLightProgramsDataV1,
} from "../../scene/model/scene-slice";
import type { StepLightKadrV1, StepLightKadrsDataV1 } from "../../../shared/types/script";
import { createId } from "../../../shared/utils/createId";
import { parseLightChannel } from "../../../shared/components/show-script/utils/lightTokens";

export const LIGHT_KADR_ANCHOR_RE = /<!--\s*lk:([a-zA-Z0-9_-]+)\s*-->/g;
export const LIGHT_KADR_HEADING_RE = /^###\s*Картина\s+(\d+)\b/im;
export const LIGHT_KADR_LINE_RE = /^-\s*\*\*Свет\*\*:\s*(.*)$/im;
export const LIGHT_LINE_PREFIX = "- **Свет**:";

export function createLightKadrId(): string {
  return createId();
}

export function normalizeLightKadrs(
  raw: StepLightKadrsDataV1 | StepLightKadrV1[] | null | undefined,
): StepLightKadrsDataV1 {
  const list = Array.isArray(raw)
    ? raw
    : raw && raw.v === 1 && Array.isArray(raw.kadrs)
      ? raw.kadrs
      : [];
  const kadrs = list
    .map((item) => normalizeLightKadr(item))
    .filter((item): item is StepLightKadrV1 => item != null);
  return { v: 1, kadrs };
}

export function readStepLightKadrs(
  step: { lightKadrs?: StepLightKadrsDataV1 | null } | null | undefined,
): StepLightKadrsDataV1 {
  return normalizeLightKadrs(step?.lightKadrs ?? null);
}

function normalizeLightKadr(raw: Partial<StepLightKadrV1> | null | undefined): StepLightKadrV1 | null {
  if (!raw || typeof raw.id !== "string" || !raw.id.trim()) return null;
  const kadrNo = Math.max(1, Math.trunc(Number(raw.kadrNo) || 1));
  const programId = Math.max(0, Math.trunc(Number(raw.programId) || 0));
  const faders = Array.isArray(raw.faders)
    ? raw.faders
        .map((f) => ({
          faderId: Math.max(1, Math.trunc(Number(f.faderId) || 0)),
          intensity:
            typeof f.intensity === "number" && Number.isFinite(f.intensity)
              ? Math.min(1, Math.max(0, f.intensity))
              : undefined,
          enabled: f.enabled,
        }))
        .filter((f) => f.faderId > 0)
    : [];
  return {
    id: raw.id.trim(),
    kadrNo,
    title: typeof raw.title === "string" ? raw.title.trim() || undefined : undefined,
    programId,
    faders,
    nextProgramId:
      raw.nextProgramId != null && Number.isFinite(Number(raw.nextProgramId))
        ? Math.max(1, Math.trunc(Number(raw.nextProgramId)))
        : undefined,
    blackout: raw.blackout === true,
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
  kadrs: StepLightKadrsDataV1,
  id: string,
): StepLightKadrV1 | undefined {
  return kadrs.kadrs.find((k) => k.id === id);
}

export function buildKadrFaderSnapshot(faders: SceneLightFadersDataV1): StepLightKadrV1["faders"] {
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
  faders: SceneLightFadersDataV1;
  nextProgramId?: number;
  blackout?: boolean;
  note?: string;
}): StepLightKadrV1 {
  return {
    id: args.id,
    kadrNo: args.kadrNo,
    title: args.title,
    programId: args.programId,
    faders: buildKadrFaderSnapshot(args.faders),
    nextProgramId: args.nextProgramId,
    blackout: args.blackout,
    note: args.note,
    updatedAt: new Date().toISOString(),
  };
}

function programLabel(
  programId: number,
  programs: SceneLightProgramsDataV1 | null | undefined,
  lightChannels: string[],
): string {
  if (programId <= 0) return "блекаут";
  const program = programs?.programs.find((p) => p.id === programId);
  if (program?.label?.trim()) return program.label.trim();
  const channelRaw = lightChannels[programId - 1];
  if (channelRaw) {
    const parsed = parseLightChannel(channelRaw);
    if (parsed.label) return parsed.label;
  }
  return `П${programId}`;
}

export function formatLightKadrLine(
  kadr: StepLightKadrV1,
  options: {
    lightChannels: string[];
    lightFaders: SceneLightFadersDataV1;
    programs?: SceneLightProgramsDataV1 | null;
  },
): string {
  if (kadr.blackout || kadr.programId <= 0) {
    return `${LIGHT_LINE_PREFIX} {{blackout}}`;
  }

  const label = programLabel(kadr.programId, options.programs ?? null, options.lightChannels);
  const parts: string[] = [`{{program:${kadr.programId}|${label}}}`];

  const faderTokens: string[] = [];
  for (const state of [...kadr.faders].sort((a, b) => a.faderId - b.faderId)) {
    if (state.enabled === false || (state.intensity ?? 0) <= 0.02) continue;
    const def = options.lightFaders.faders.find((f) => f.id === state.faderId);
    const pct = Math.round(Math.min(1, Math.max(0, state.intensity ?? 0)) * 100);
    const flabel = def?.label?.trim() || `Ф${state.faderId}`;
    faderTokens.push(`{{fader:${state.faderId}|${flabel} ${pct}%}}`);
  }
  if (faderTokens.length > 0) {
    parts.push(faderTokens.join(" · "));
  }

  if (kadr.nextProgramId != null && kadr.nextProgramId > 0) {
    const nextLabel = programLabel(
      kadr.nextProgramId,
      options.programs ?? null,
      options.lightChannels,
    );
    parts.push(`→ {{program:${kadr.nextProgramId}|${nextLabel}}}`);
  }

  return `${LIGHT_LINE_PREFIX} ${parts.join(" · ")}`;
}

export function ensureKadrAnchorInMarkdown(
  markdown: string,
  section: MarkdownKadrSection,
  kadrId: string,
): string {
  if (section.id === kadrId) return markdown;
  const text = String(markdown ?? "");
  const anchor = `\n<!-- lk:${kadrId} -->`;
  if (section.id) {
    const oldAnchor = new RegExp(`\\n\\s*<!--\\s*lk:${section.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*-->`, "i");
    return text.replace(oldAnchor, anchor);
  }
  const insertAt = section.headingEnd;
  return text.slice(0, insertAt) + anchor + text.slice(insertAt);
}

export function upsertLightLineInSection(
  markdown: string,
  section: MarkdownKadrSection,
  lightLine: string,
): string {
  const text = String(markdown ?? "");
  const slice = text.slice(section.headingEnd, section.sectionEnd);
  const lineMatch = slice.match(LIGHT_KADR_LINE_RE);
  if (lineMatch && lineMatch.index != null) {
    const absStart = section.headingEnd + lineMatch.index;
    const absEnd = absStart + lineMatch[0].length;
    return text.slice(0, absStart) + lightLine + text.slice(absEnd);
  }
  const insertAt = section.headingEnd;
  const prefix = text.slice(insertAt, insertAt + 1) === "\n" ? "" : "\n";
  return text.slice(0, insertAt) + `${prefix}\n${lightLine}\n` + text.slice(insertAt);
}

export function upsertKadrInStep(args: {
  kadrs: StepLightKadrsDataV1;
  kadr: StepLightKadrV1;
}): StepLightKadrsDataV1 {
  const next = args.kadrs.kadrs.filter((k) => k.id !== args.kadr.id);
  next.push(args.kadr);
  next.sort((a, b) => a.kadrNo - b.kadrNo || a.id.localeCompare(b.id));
  return { v: 1, kadrs: next };
}

export function recordKadrToMarkdown(args: {
  markdown: string;
  section: MarkdownKadrSection;
  kadr: StepLightKadrV1;
  lightChannels: string[];
  lightFaders: SceneLightFadersDataV1;
  programs?: SceneLightProgramsDataV1 | null;
}): string {
  let next = ensureKadrAnchorInMarkdown(args.markdown, args.section, args.kadr.id);
  const sectionAfterAnchor = scanMarkdownKadrSections(next).find(
    (s) => s.id === args.kadr.id || s.kadrNo === args.kadr.kadrNo,
  );
  if (!sectionAfterAnchor) return next;
  const lightLine = formatLightKadrLine(args.kadr, {
    lightChannels: args.lightChannels,
    lightFaders: args.lightFaders,
    programs: args.programs,
  });
  next = upsertLightLineInSection(next, sectionAfterAnchor, lightLine);
  return next;
}

export function applyKadrToFaders(
  kadr: StepLightKadrV1,
  faders: SceneLightFadersDataV1,
): SceneLightFadersDataV1 {
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

export function createKadrTemplateSnippet(kadrNo: number, kadrId: string): string {
  return `\n\n### Картина ${kadrNo}\n<!-- lk:${kadrId} -->\n\n${LIGHT_LINE_PREFIX} _не записано — «Записать в картину»_\n\n- **Мизансцена**:\n- **Действие/задача**:\n- **Переход**:\n`;
}

const TOKEN_PROGRAM_RE = /\{\{\s*program\s*:\s*(\d+)\s*(?:\|\s*([^}]+?))?\s*}}/gi;
const TOKEN_FADER_RE = /\{\{\s*fader\s*:\s*(\d+)\s*(?:\|\s*([^}]+?))?\s*}}/gi;
const TOKEN_BLACKOUT_RE = /\{\{\s*blackout\s*(?:\|\s*([^}]+?))?\s*}}/gi;

function parsePercent(raw: string | undefined): number | undefined {
  const text = String(raw ?? "").trim().replace(/,/g, ".");
  if (!text) return undefined;
  const m = text.match(/^(\d+(?:\.\d+)?)\s*%?$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
}

export function parseLightKadrLine(line: string): Partial<StepLightKadrV1> | null {
  const trimmed = String(line ?? "").trim();
  if (!trimmed.toLowerCase().startsWith("- **свет**:")) return null;

  TOKEN_BLACKOUT_RE.lastIndex = 0;
  TOKEN_PROGRAM_RE.lastIndex = 0;
  TOKEN_FADER_RE.lastIndex = 0;

  const hasBlackout = TOKEN_BLACKOUT_RE.test(trimmed);
  TOKEN_PROGRAM_RE.lastIndex = 0;
  const programMatches = [...trimmed.matchAll(TOKEN_PROGRAM_RE)];
  TOKEN_FADER_RE.lastIndex = 0;
  const faderMatches = [...trimmed.matchAll(TOKEN_FADER_RE)];

  if (!hasBlackout && programMatches.length === 0 && faderMatches.length === 0) {
    return null;
  }

  let programId = 0;
  let blackout = false;
  const faders: StepLightKadrV1["faders"] = [];
  let nextProgramId: number | undefined;

  if (hasBlackout) {
    blackout = true;
    programId = 0;
  }

  if (programMatches.length > 0) {
    programId = Math.max(1, Math.trunc(Number(programMatches[0][1]) || 1));
    if (programMatches.length > 1) {
      nextProgramId = Math.max(1, Math.trunc(Number(programMatches[1][1]) || 1));
    }
  }

  for (const match of faderMatches) {
    const faderId = Math.max(1, Math.trunc(Number(match[1]) || 0));
    if (faderId <= 0) continue;
    const intensity = parsePercent(match[2]);
    faders.push({
      faderId,
      intensity: intensity ?? 1,
      enabled: (intensity ?? 1) > 0,
    });
  }

  return {
    programId: blackout ? 0 : programId || 1,
    blackout,
    faders,
    nextProgramId,
  };
}

export function lightKadrsStableKey(data: StepLightKadrsDataV1 | null | undefined): string {
  const kadrs = normalizeLightKadrs(data).kadrs;
  return JSON.stringify(
    kadrs.map((k) => ({
      id: k.id,
      kadrNo: k.kadrNo,
      title: k.title ?? null,
      programId: k.programId,
      faders: k.faders,
      nextProgramId: k.nextProgramId ?? null,
      blackout: k.blackout ?? false,
      note: k.note ?? null,
    })),
  );
}

export function syncLightKadrsFromMarkdown(args: {
  markdown: string;
  kadrs: StepLightKadrsDataV1;
}): StepLightKadrsDataV1 {
  const sections = scanMarkdownKadrSections(args.markdown);
  if (sections.length === 0) return args.kadrs;

  const byId = new Map(args.kadrs.kadrs.map((k) => [k.id, { ...k }]));
  const nextKadrs: StepLightKadrV1[] = [];

  for (const section of sections) {
    const slice = args.markdown.slice(section.headingEnd, section.sectionEnd);
    const lineMatch = slice.match(LIGHT_KADR_LINE_RE);
    const parsed = lineMatch ? parseLightKadrLine(lineMatch[0]) : null;
    const existingById = section.id ? byId.get(section.id) : undefined;
    const existingByNo = args.kadrs.kadrs.find((k) => k.kadrNo === section.kadrNo);
    const existing = existingById ?? existingByNo;
    const id = section.id ?? existing?.id ?? createLightKadrId();
    const base: StepLightKadrV1 = existing ?? {
      id,
      kadrNo: section.kadrNo,
      programId: 1,
      faders: [],
    };

    const merged = normalizeLightKadr({
      ...base,
      id,
      kadrNo: section.kadrNo,
      title: section.headingTitle,
      ...(parsed ?? {}),
    })!;
    const prevSnapshot = existing
      ? lightKadrsStableKey({ v: 1, kadrs: [existing] })
      : "";
    const nextSnapshot = lightKadrsStableKey({ v: 1, kadrs: [merged] });
    const contentChanged = prevSnapshot !== nextSnapshot;
    nextKadrs.push({
      ...merged,
      updatedAt:
        parsed && contentChanged ? new Date().toISOString() : base.updatedAt ?? merged.updatedAt,
    });
  }

  return { v: 1, kadrs: nextKadrs };
}

export function fadersForKadrDisplay(
  kadr: StepLightKadrV1,
  baseFaders: SceneLightFadersDataV1,
): SceneLightFadersDataV1 {
  return applyKadrToFaders(kadr, baseFaders);
}

export type LightKadrFaderDef = SceneLightFaderV1;
