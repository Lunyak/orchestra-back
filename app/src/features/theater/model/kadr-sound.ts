import type { MarkdownKadrSection } from "./light-kadrs";

const LIGHT_KADR_LINE_RE = /^-\s*\*\*Свет\*\*:\s*([^\n]*)/im;

export const SOUND_LINE_PREFIX = "- **Звук**:";
export const SOUND_KADR_LINE_RE = /^-\s*\*\*Звук\*\*:\s*([^\n]*)/im;

export type KadrSoundCue = {
  playTrackIds: number[];
  soundIds: number[];
  /** Громкость плеера 0…1 (в тексте «80%»). */
  volume?: number;
  fadeMs?: number;
};

const TOKEN_PLAY_RE = /\{\{\s*play\s*:\s*(\d+)(?:\|([^}]+?))?\s*}}/gi;
const TOKEN_SOUND_RE = /\{\{\s*(?:sound|sfx)\s*:\s*(\d+)(?:\|([^}]+?))?\s*}}/gi;
const TRACK_LINK_RE = /\[[^\]]*\]\(\s*track\s*:\s*(\d+)\s*\)/gi;
const TOKEN_FADE_MS_RE =
  /(?:fade|затухание|fadeMs)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(ms|мс|s|с|sec|сек)?/gi;
const TOKEN_VOLUME_RE = /(?:громкость\s*)?(\d{1,3})\s*%/gi;

function parseFadeMs(raw: string, unit: string | undefined): number | undefined {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const u = String(unit ?? "ms").toLowerCase();
  if (u === "s" || u === "с" || u === "sec" || u === "сек") {
    return Math.round(n * 1000);
  }
  if (n <= 30 && !unit) return Math.round(n * 1000);
  return Math.round(n);
}

export function parseSoundKadrLine(line: string): KadrSoundCue | null {
  const trimmed = String(line ?? "").trim();
  if (!trimmed.toLowerCase().startsWith("- **звук**:")) return null;

  TOKEN_PLAY_RE.lastIndex = 0;
  TOKEN_SOUND_RE.lastIndex = 0;
  TRACK_LINK_RE.lastIndex = 0;
  TOKEN_FADE_MS_RE.lastIndex = 0;
  TOKEN_VOLUME_RE.lastIndex = 0;

  const playMatches = [...trimmed.matchAll(TOKEN_PLAY_RE)];
  const trackLinkMatches = [...trimmed.matchAll(TRACK_LINK_RE)];
  const soundMatches = [...trimmed.matchAll(TOKEN_SOUND_RE)];
  const fadeMatch = TOKEN_FADE_MS_RE.exec(trimmed);
  const volumeMatch = TOKEN_VOLUME_RE.exec(trimmed);
  TOKEN_FADE_MS_RE.lastIndex = 0;
  TOKEN_VOLUME_RE.lastIndex = 0;

  if (playMatches.length === 0 && trackLinkMatches.length === 0 && soundMatches.length === 0) {
    const body = trimmed.replace(/^-\s*\*\*звук\*\*:\s*/i, "").trim();
    if (!body || /^_/.test(body) || /не записано/i.test(body)) return null;
    return null;
  }

  const playTrackIds = [...playMatches, ...trackLinkMatches]
    .map((m) => Math.trunc(Number(m[1]) || 0))
    .filter((id) => id > 0);
  const soundIds = soundMatches
    .map((m) => Math.trunc(Number(m[1]) || 0))
    .filter((id) => id > 0);

  let fadeMs: number | undefined;
  if (fadeMatch) {
    fadeMs = parseFadeMs(fadeMatch[1], fadeMatch[2]);
  }

  let volume: number | undefined;
  if (volumeMatch) {
    const pct = Math.trunc(Number(volumeMatch[1]) || 0);
    if (pct >= 0 && pct <= 100) volume = pct / 100;
  }

  return {
    playTrackIds: [...new Set(playTrackIds)],
    soundIds: [...new Set(soundIds)],
    volume,
    fadeMs,
  };
}

export function findSoundLineInSection(
  markdown: string,
  section: MarkdownKadrSection,
): string | null {
  const slice = String(markdown ?? "").slice(section.headingEnd, section.sectionEnd);
  const match = slice.match(SOUND_KADR_LINE_RE);
  return match?.[1] != null ? match[1].trim() : null;
}

export function parseSoundLineInSection(
  markdown: string,
  section: MarkdownKadrSection,
): KadrSoundCue | null {
  const body = findSoundLineInSection(markdown, section);
  if (body == null) return null;
  return parseSoundKadrLine(`${SOUND_LINE_PREFIX} ${body}`);
}

export function parseSoundVolumeFromFieldBody(body: string): number | undefined {
  TOKEN_VOLUME_RE.lastIndex = 0;
  const volumeMatch = TOKEN_VOLUME_RE.exec(String(body ?? ""));
  TOKEN_VOLUME_RE.lastIndex = 0;
  if (!volumeMatch) return undefined;
  const pct = Math.trunc(Number(volumeMatch[1]) || 0);
  if (pct < 0 || pct > 100) return undefined;
  return pct / 100;
}

export function formatSoundKadrLine(
  cue: KadrSoundCue,
  options: {
    playlist?: Array<{ id: number; title: string }>;
    sounds?: Array<{ id: number; title: string }>;
  },
): string {
  const parts: string[] = [];

  for (const trackId of cue.playTrackIds) {
    const track = options.playlist?.find((t) => Number(t.id) === trackId);
    const label = track?.title?.trim() || `Трек ${trackId}`;
    const safeTitle = label.replace(/\\/g, "\\\\").replace(/]/g, "\\]");
    parts.push(`[${safeTitle}](track:${trackId})`);
  }

  for (const soundId of cue.soundIds) {
    const sound = options.sounds?.find((s) => Number(s.id) === soundId);
    const label = sound?.title?.trim() || "SFX";
    parts.push(`{{sound:${soundId}|${label}}}`);
  }

  if (cue.playTrackIds.length > 0 && cue.volume != null && Number.isFinite(cue.volume)) {
    const pct = Math.round(Math.min(1, Math.max(0, cue.volume)) * 100);
    parts.push(`${pct}%`);
  }

  if (parts.length === 0) {
    return `${SOUND_LINE_PREFIX} _не записано — выберите трек при создании картины_`;
  }

  return `${SOUND_LINE_PREFIX} ${parts.join(" · ")}`;
}

export function upsertSoundLineInSection(
  markdown: string,
  section: MarkdownKadrSection,
  soundLine: string,
): string {
  const text = String(markdown ?? "");
  const slice = text.slice(section.headingEnd, section.sectionEnd);
  const lineMatch = slice.match(SOUND_KADR_LINE_RE);

  if (lineMatch && lineMatch.index != null) {
    const absStart = section.headingEnd + lineMatch.index;
    const absEnd = absStart + lineMatch[0].length;
    return text.slice(0, absStart) + soundLine + text.slice(absEnd);
  }

  const lightMatch = slice.match(LIGHT_KADR_LINE_RE);
  const insertAfterLight =
    lightMatch && lightMatch.index != null
      ? section.headingEnd + lightMatch.index + lightMatch[0].length
      : section.headingEnd;

  const prefix = text.slice(insertAfterLight, insertAfterLight + 1) === "\n" ? "" : "\n";
  return text.slice(0, insertAfterLight) + `${prefix}\n${soundLine}\n` + text.slice(insertAfterLight);
}
