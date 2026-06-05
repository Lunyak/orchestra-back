import type { MarkdownKadrSection } from "./light-kadrs";

const LIGHT_KADR_LINE_RE = /^-\s*\*\*Свет\*\*:\s*(.*)$/im;
const SOUND_KADR_LINE_RE = /^-\s*\*\*Звук\*\*:\s*(.*)$/im;

export const VIDEO_LINE_PREFIX = "- **Видео**:";

/** @deprecated Старые кадры; новые записываем как «Видео». */
export const PROJECTOR_LINE_PREFIX = "- **Проектор**:";

export const VIDEO_KADR_LINE_RE = /^-\s*\*\*(?:Видео|Проектор)\*\*:\s*(.*)$/im;

export type KadrProjectorCue =
  | { mode: "hold"; holdId?: number }
  | { mode: "video"; videoId: number };

const TOKEN_VIDEO_RE = /\{\{\s*video\s*:\s*(\d+)(?:\|([^}]+?))?\s*}}/gi;
const TOKEN_HOLD_ID_RE = /\{\{\s*hold\s*:\s*(\d+)\s*}}/gi;
const TOKEN_HOLD_BARE_RE = /\{\{\s*hold\s*}}/gi;

function isVideoKadrLine(line: string): boolean {
  const trimmed = String(line ?? "").trim().toLowerCase();
  return trimmed.startsWith("- **видео**:") || trimmed.startsWith("- **проектор**:");
}

export function parseProjectorKadrLine(line: string): KadrProjectorCue | null {
  const trimmed = String(line ?? "").trim();
  if (!isVideoKadrLine(trimmed)) return null;

  TOKEN_VIDEO_RE.lastIndex = 0;
  TOKEN_HOLD_ID_RE.lastIndex = 0;
  TOKEN_HOLD_BARE_RE.lastIndex = 0;

  const videoMatches = [...trimmed.matchAll(TOKEN_VIDEO_RE)];
  const holdIdMatches = [...trimmed.matchAll(TOKEN_HOLD_ID_RE)];
  const holdBareMatches = [...trimmed.matchAll(TOKEN_HOLD_BARE_RE)];

  if (videoMatches.length > 0) {
    const videoId = Math.trunc(Number(videoMatches[0][1]) || 0);
    if (videoId > 0) return { mode: "video", videoId };
  }

  if (holdIdMatches.length > 0) {
    const holdId = Math.trunc(Number(holdIdMatches[0][1]) || 0);
    if (holdId > 0) return { mode: "hold", holdId };
  }

  if (holdBareMatches.length > 0) return { mode: "hold" };

  const body = trimmed.replace(/^-\s*\*\*(?:видео|проектор)\*\*:\s*/i, "").trim();
  if (!body || /^_/.test(body) || /не записано/i.test(body)) return null;

  return null;
}

export function findProjectorLineInSection(
  markdown: string,
  section: MarkdownKadrSection,
): string | null {
  const slice = String(markdown ?? "").slice(section.headingEnd, section.sectionEnd);
  const match = slice.match(VIDEO_KADR_LINE_RE);
  return match?.[1] != null ? match[1].trim() : null;
}

export function parseProjectorLineInSection(
  markdown: string,
  section: MarkdownKadrSection,
): KadrProjectorCue | null {
  const body = findProjectorLineInSection(markdown, section);
  if (body == null) return null;
  return parseProjectorKadrLine(`${VIDEO_LINE_PREFIX} ${body}`);
}

export function formatProjectorKadrLine(
  cue: KadrProjectorCue,
  options?: {
    videos?: Array<{ id: number; title: string }>;
    holdImages?: Array<{ id: number; title: string }>;
  },
): string {
  if (cue.mode === "hold") {
    if (cue.holdId != null && cue.holdId > 0) {
      const hold = options?.holdImages?.find((h) => Number(h.id) === cue.holdId);
      const label = hold?.title?.trim() || `Заставка ${cue.holdId}`;
      const safeTitle = label.replace(/\\/g, "\\\\").replace(/]/g, "\\]");
      return `${VIDEO_LINE_PREFIX} {{hold:${cue.holdId}}} [${safeTitle}](hold:${cue.holdId})`;
    }
    return `${VIDEO_LINE_PREFIX} {{hold}}`;
  }

  const video = options?.videos?.find((v) => Number(v.id) === cue.videoId);
  const label = video?.title?.trim() || `Видео ${cue.videoId}`;
  const safeTitle = label.replace(/\\/g, "\\\\").replace(/]/g, "\\]");
  return `${VIDEO_LINE_PREFIX} {{video:${cue.videoId}}} [${safeTitle}](video:${cue.videoId})`;
}

export function upsertProjectorLineInSection(
  markdown: string,
  section: MarkdownKadrSection,
  projectorLine: string,
): string {
  const text = String(markdown ?? "");
  const slice = text.slice(section.headingEnd, section.sectionEnd);
  const lineMatch = slice.match(VIDEO_KADR_LINE_RE);

  if (lineMatch && lineMatch.index != null) {
    const absStart = section.headingEnd + lineMatch.index;
    const absEnd = absStart + lineMatch[0].length;
    return text.slice(0, absStart) + projectorLine + text.slice(absEnd);
  }

  const soundMatch = slice.match(SOUND_KADR_LINE_RE);
  const lightMatch = slice.match(LIGHT_KADR_LINE_RE);
  const insertAfter =
    soundMatch && soundMatch.index != null
      ? section.headingEnd + soundMatch.index + soundMatch[0].length
      : lightMatch && lightMatch.index != null
        ? section.headingEnd + lightMatch.index + lightMatch[0].length
        : section.headingEnd;

  const prefix = text.slice(insertAfter, insertAfter + 1) === "\n" ? "" : "\n";
  return text.slice(0, insertAfter) + `${prefix}\n${projectorLine}\n` + text.slice(insertAfter);
}
