const FENCE_RE = /```[\s\S]*?```/g;

const PICTURE_LABEL_LINE_RE =
  /^\s{0,3}[-*+]\s+\*\*(?:Картинка|Мизансцена)\*\*:\s*$/i;
const LIGHT_LABEL_ONLY_LINE_RE = /^\s{0,3}[-*+]\s+\*\*Свет\*\*:\s*$/i;
const LIGHT_LINE_RE = /^\s{0,3}[-*+]\s+\*\*Свет\*\*:/i;
const KADR_FIELD_LINE_RE =
  /^\s{0,3}[-*+]\s+\*\*(?:Звук|Видео|Проектор|Действие\/задача|Действие|Переход)\*\*:/i;
const IMAGE_LINE_RE = /^\s*!\[/;
const LIGHT_TOKEN_LINE_RE = /^\s*\{\{\s*(?:lightpanel|light|blackout|program|fader)\b/i;

function isLightBlockLine(line: string): boolean {
  const t = line.trim();
  if (LIGHT_LINE_RE.test(t)) return true;
  if (LIGHT_TOKEN_LINE_RE.test(t)) return true;
  return false;
}

function needsBlankAfterKadrLabelLine(line: string, next: string): boolean {
  if (PICTURE_LABEL_LINE_RE.test(line) && IMAGE_LINE_RE.test(next)) return true;
  if (LIGHT_LABEL_ONLY_LINE_RE.test(line) && LIGHT_TOKEN_LINE_RE.test(next)) return true;
  if (isLightBlockLine(line) && KADR_FIELD_LINE_RE.test(next)) return true;
  if (LIGHT_TOKEN_LINE_RE.test(line) && KADR_FIELD_LINE_RE.test(next)) return true;
  return false;
}

function expandKadrLabelBlockBreaksInSegment(segment: string): string {
  const lines = segment.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    out.push(line);
    if (i + 1 >= lines.length) continue;
    const next = lines[i + 1]!;
    if (needsBlankAfterKadrLabelLine(line, next)) {
      out.push("");
    }
  }
  return out.join("\n");
}

/** Пустая строка после «Картинка»/«Свет», иначе commonmark клеит блок в один пункт списка. */
export function expandKadrLabelBlockBreaks(markdown: string): string {
  const src = String(markdown ?? "");
  if (!src) return src;
  FENCE_RE.lastIndex = 0;
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(src)) !== null) {
    parts.push(expandKadrLabelBlockBreaksInSegment(src.slice(last, m.index)));
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  parts.push(expandKadrLabelBlockBreaksInSegment(src.slice(last)));
  return parts.join("");
}
