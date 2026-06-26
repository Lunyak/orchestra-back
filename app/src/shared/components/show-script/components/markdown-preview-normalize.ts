import { getDesktopApi } from "../../../platform/desktop-api";
import {
  httpUrlToImageFileName,
  decodeOrchestraImageStorageKey,
  storageKeyToImageBasename,
} from "../../../utils/markdownImages";

export function looksLikeOpaqueMediaId(value: string): boolean {
  const t = String(value ?? "").trim();
  if (!t) return false;
  if (/^[a-f0-9]{24,}$/i.test(t)) return true;
  if (/^orchestra-image:/i.test(t)) return true;
  return false;
}

export function desktopOfflineImageFromCache(
  rawHref: string,
  resolveImageSrc: (src?: string) => string | undefined,
): string | undefined {
  if (!getDesktopApi()?.invoke) return undefined;
  if (rawHref.startsWith("orchestra-image:")) {
    const enc = rawHref.replace(/^orchestra-image:/i, "").trim();
    const key = decodeOrchestraImageStorageKey(enc);
    const bn = storageKeyToImageBasename(key);
    if (!bn) return undefined;
    return resolveImageSrc(`images/${bn}`);
  }
  if (/^https?:\/\//i.test(rawHref)) {
    const bn = httpUrlToImageFileName(rawHref);
    return resolveImageSrc(`images/${bn}`);
  }
  return undefined;
}

export const LINE_LABEL_CLASSNAMES = new Set([
  "markdown-speaker-label",
  "markdown-light-chip",
  "markdown-play-label",
  "markdown-sound-label",
  "markdown-video-label",
]);

export function markdownHasRoleLightOrPlayLineLabels(markdown: string): boolean {
  const raw = String(markdown ?? "");
  if (!raw.trim()) return false;
  const withoutCodeFences = raw.replace(/```[\s\S]*?```/g, "");
  const re =
    /(^|\n)\s*(\[\[\s*[^\]]+?\s*]]|\{\{\s*(?:light|blackout|play|sound|sfx)\b[^}]*}})/i;
  return re.test(withoutCodeFences);
}

const FENCE_RE = /```[\s\S]*?```/g;

function isMarkdownListItemLine(line: string): boolean {
  return /^\s{0,3}[-*+]\s+/.test(line);
}

function isScriptishBlockLine(line: string): boolean {
  const t = line.replace(/^\s{0,3}>\s?/, "").replace(/^\s{0,3}[-*+]\s+/, "").trim();
  if (!t) return false;
  if (/^\[\[/.test(t)) return true;
  if (/^\{\{\s*(?:light|blackout|b|play|sound|sfx)\b/i.test(t)) return true;
  if (/^\[[^\]]*]\(\s*(?:track|playlist)\s*:/i.test(t)) return true;
  if (/^!\[/.test(t)) return true;
  return false;
}

function needsSyntheticParagraphBlankBetweenAdjacentLines(line: string, next: string): boolean {
  const lineList = isMarkdownListItemLine(line);
  const nextList = isMarkdownListItemLine(next);
  const lineScr = isScriptishBlockLine(line) && !lineList;
  const nextScr = isScriptishBlockLine(next) && !nextList;

  if (lineScr && nextScr) return true;
  if (line.trim() !== "" && !lineScr && !lineList && nextScr) return true;
  if (lineScr && !lineList && !nextList && !nextScr && next.trim() !== "") return true;

  return false;
}

function expandScriptLineParagraphBreaksInSegment(segment: string): string {
  const lines = segment.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    out.push(line);
    if (i + 1 >= lines.length) break;
    const next = lines[i + 1]!;
    if (needsSyntheticParagraphBlankBetweenAdjacentLines(line, next)) {
      out.push("");
    }
  }
  return out.join("\n");
}

export function expandScriptLineParagraphBreaks(
  markdown: string,
  annotationsMode: boolean,
  annotationCount: number,
): string {
  if (annotationsMode && annotationCount > 0) return markdown;
  const src = String(markdown ?? "");
  if (!src) return src;
  FENCE_RE.lastIndex = 0;
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(src)) !== null) {
    parts.push(expandScriptLineParagraphBreaksInSegment(src.slice(last, m.index)));
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  parts.push(expandScriptLineParagraphBreaksInSegment(src.slice(last)));
  return parts.join("");
}

function injectNbspParagraphsForTripleNewlinesInSegment(segment: string): string {
  return segment.replace(/\n{3,}/g, (run) => {
    const n = run.length;
    return "\n\n" + Array.from({ length: n - 2 }, () => "\u00a0").join("\n\n") + "\n\n";
  });
}

export function injectNbspParagraphsForTripleNewlines(markdown: string): string {
  const src = String(markdown ?? "");
  if (!src) return src;
  FENCE_RE.lastIndex = 0;
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(src)) !== null) {
    parts.push(injectNbspParagraphsForTripleNewlinesInSegment(src.slice(last, m.index)));
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  parts.push(injectNbspParagraphsForTripleNewlinesInSegment(src.slice(last)));
  return parts.join("");
}
