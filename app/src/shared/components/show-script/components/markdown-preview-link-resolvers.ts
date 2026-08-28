import type {
  SoundLinkPayload,
  TrackLinkPayload,
  VideoLinkPayload,
} from "./markdown-preview-types";

export function urlTransform(url: string): string {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("javascript:")) {
    return "";
  }
  return url;
}

export function normalizeTrackName(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function resolveTrackLink(href?: string): TrackLinkPayload | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (trimmed.startsWith("track:")) {
    const payload = trimmed.replace(/^track:/i, "").trim();
    const id = Number(payload);
    if (Number.isFinite(id)) {
      return { id };
    }
    return payload ? { name: normalizeTrackName(payload) } : null;
  }
  if (trimmed.startsWith("playlist:")) {
    const payload = trimmed.replace(/^playlist:/i, "").trim();
    const id = Number(payload);
    if (Number.isFinite(id)) {
      return { id };
    }
    return payload ? { name: normalizeTrackName(payload) } : null;
  }
  return null;
}

export function resolveSoundLink(href?: string): SoundLinkPayload | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (trimmed.startsWith("sound:") || trimmed.startsWith("sfx:")) {
    const payload = trimmed.replace(/^(sound|sfx):/i, "").trim();
    const id = Number(payload);
    if (Number.isFinite(id)) {
      return { id };
    }
    return payload ? { name: normalizeTrackName(payload) } : null;
  }
  return null;
}

export function resolveVideoLink(href?: string): VideoLinkPayload | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed.startsWith("video:")) return null;
  const payload = trimmed.replace(/^video:/i, "").trim();
  const id = Number(payload);
  if (!Number.isFinite(id) || id <= 0) return null;
  return { id: Math.trunc(id) };
}

export function resolveHoldLink(href?: string): { id: number } | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed.startsWith("hold:")) return null;
  const payload = trimmed.replace(/^hold:/i, "").trim();
  const id = Number(payload);
  if (!Number.isFinite(id) || id <= 0) return null;
  return { id: Math.trunc(id) };
}

export function isAudioLink(href?: string): boolean {
  if (!href) return false;
  return /\.(mp3|wav|ogg|m4a|flac)$/i.test(href.trim());
}
