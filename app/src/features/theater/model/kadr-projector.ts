import type { MarkdownKadrSection } from "./light-kadrs";

const LIGHT_KADR_LINE_RE = /^-\s*\*\*Свет\*\*:\s*(.*)$/im;
const SOUND_KADR_LINE_RE = /^-\s*\*\*Звук\*\*:\s*(.*)$/im;

export const VIDEO_LINE_PREFIX = "- **Видео**:";

/** @deprecated Старые кадры; новые записываем как «Видео». */
export const PROJECTOR_LINE_PREFIX = "- **Проектор**:";

export const VIDEO_KADR_LINE_RE = /^-\s*\*\*(?:Видео|Проектор)\*\*:\s*(.*)$/im;

export type KadrProjectorCue =
  | { mode: "hold"; holdId?: number }
  | { mode: "video"; videoId: number; muted?: boolean };

const VIDEO_MUTE_MODIFIERS = new Set(["mute", "silent", "без звука", "без_звука"]);

function isVideoMutedModifier(value: string | undefined): boolean {
  if (!value) return false;
  return VIDEO_MUTE_MODIFIERS.has(value.trim().toLowerCase());
}

const TOKEN_VIDEO_RE = /\{\{\s*video\s*:\s*(\d+)(?:\|([^}]+?))?\s*}}/gi;
const TOKEN_HOLD_ID_RE = /\{\{\s*hold\s*:\s*(\d+)\s*}}/gi;
const TOKEN_HOLD_BARE_RE = /\{\{\s*hold\s*}}/gi;
const VIDEO_LINK_RE = /\[[^\]]*\]\(\s*video\s*:\s*(\d+)(?:\s*\|\s*([^)]+?))?\s*\)/gi;
const HOLD_LINK_RE = /\[[^\]]*\]\(\s*hold\s*:\s*(\d+)\s*\)/gi;

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
  VIDEO_LINK_RE.lastIndex = 0;
  HOLD_LINK_RE.lastIndex = 0;

  const videoMatches = [...trimmed.matchAll(TOKEN_VIDEO_RE)];
  const videoLinkMatches = [...trimmed.matchAll(VIDEO_LINK_RE)];
  const holdIdMatches = [...trimmed.matchAll(TOKEN_HOLD_ID_RE)];
  const holdLinkMatches = [...trimmed.matchAll(HOLD_LINK_RE)];
  const holdBareMatches = [...trimmed.matchAll(TOKEN_HOLD_BARE_RE)];

  const videoIdFromToken = videoMatches[0]?.[1];
  const videoMuteFromToken = videoMatches[0]?.[2];
  const videoIdFromLink = videoLinkMatches[0]?.[1];
  const videoMuteFromLink = videoLinkMatches[0]?.[2];
  const resolvedVideoId = Math.trunc(Number(videoIdFromToken ?? videoIdFromLink) || 0);
  if (resolvedVideoId > 0) {
    const muted =
      isVideoMutedModifier(videoMuteFromToken) || isVideoMutedModifier(videoMuteFromLink);
    return muted
      ? { mode: "video", videoId: resolvedVideoId, muted: true }
      : { mode: "video", videoId: resolvedVideoId };
  }

  const holdIdFromToken = holdIdMatches[0]?.[1];
  const holdIdFromLink = holdLinkMatches[0]?.[1];
  const resolvedHoldId = Math.trunc(Number(holdIdFromToken ?? holdIdFromLink) || 0);
  if (resolvedHoldId > 0) return { mode: "hold", holdId: resolvedHoldId };

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
      return `${VIDEO_LINE_PREFIX} [${safeTitle}](hold:${cue.holdId})`;
    }
    return `${VIDEO_LINE_PREFIX} {{hold}}`;
  }

  const video = options?.videos?.find((v) => Number(v.id) === cue.videoId);
  const label = video?.title?.trim() || `Видео ${cue.videoId}`;
  const safeTitle = label.replace(/\\/g, "\\\\").replace(/]/g, "\\]");
  const muteSuffix = cue.muted ? "|mute" : "";
  return `${VIDEO_LINE_PREFIX} [${safeTitle}](video:${cue.videoId}${muteSuffix})`;
}

export function resolveKadrProjectorVideoOptions(
  cue: KadrProjectorCue,
  fallback?: {
    resolveMuted?: (videoId: number) => boolean;
    resolveVolume?: (videoId: number) => number;
  },
): { videoMuted: boolean; videoVolume: number } | undefined {
  if (cue.mode !== "video") return undefined;

  const videoMuted = cue.muted ?? fallback?.resolveMuted?.(cue.videoId) ?? false;
  const videoVolume = videoMuted ? 0 : (fallback?.resolveVolume?.(cue.videoId) ?? 1);

  return { videoMuted, videoVolume };
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
