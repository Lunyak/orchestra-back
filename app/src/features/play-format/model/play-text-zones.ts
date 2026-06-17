const CAST_HEADER_RE =
  /^(?:\*\*)?ДЕЙСТВУЮЩ(?:ИЕ|ИХ)\s+(?:ЛИЦА|ПЕРСОНАЖИ)(?:[:\s]*)$/i;

const PLAY_BODY_START_RE =
  /^(?:\*\*)?(?:АКТ|СЦЕНА|КАРТИН[АУЕЙ]|ДЕЙСТВИЕ)(?:\s|$|[.:])/i;

export type PlayTextZones = {
  /** Титул и служебное до списка персонажей / первого акта. */
  prefix: string;
  /** Строки списка персонажей (без заголовка «ДЕЙСТВУЮЩИЕ ЛИЦА»). */
  castContent: string | null;
  /** Текст пьесы с первого акта / сцены. */
  body: string;
};

function isCastHeaderLine(line: string): boolean {
  return CAST_HEADER_RE.test(String(line ?? "").trim());
}

function isPlayBodyStartLine(line: string): boolean {
  return PLAY_BODY_START_RE.test(String(line ?? "").trim());
}

function findCastHeaderIndex(lines: string[]): number {
  return lines.findIndex((line) => isCastHeaderLine(line));
}

function findPlayBodyStartIndex(lines: string[], fromIndex = 0): number {
  for (let i = fromIndex; i < lines.length; i += 1) {
    if (isPlayBodyStartLine(lines[i] ?? "")) return i;
  }
  return -1;
}

function findCastContentEnd(lines: string[], castHeaderIndex: number): number {
  const playStart = findPlayBodyStartIndex(lines, castHeaderIndex + 1);
  if (playStart >= 0) return playStart;
  return lines.length;
}

/** Делит пьесу на титул, список персонажей и основной текст. */
export function splitPlayTextZones(text: string): PlayTextZones {
  const lines = String(text ?? "").split("\n");
  const castHeaderIndex = findCastHeaderIndex(lines);

  if (castHeaderIndex >= 0) {
    const castEnd = findCastContentEnd(lines, castHeaderIndex);
    const prefix = lines.slice(0, castHeaderIndex + 1).join("\n");
    const castLines = lines.slice(castHeaderIndex + 1, castEnd);
    const castContent = castLines.length > 0 ? castLines.join("\n") : "";
    const body = lines.slice(castEnd).join("\n");
    return {
      prefix,
      castContent: castContent.trim() ? castContent : null,
      body,
    };
  }

  const playStart = findPlayBodyStartIndex(lines, 0);
  if (playStart > 0) {
    return {
      prefix: lines.slice(0, playStart).join("\n"),
      castContent: null,
      body: lines.slice(playStart).join("\n"),
    };
  }

  if (playStart === 0) {
    return { prefix: "", castContent: null, body: text };
  }

  return { prefix: text, castContent: null, body: "" };
}

export function joinPlayTextZones(zones: PlayTextZones): string {
  const parts: string[] = [];
  if (zones.prefix) parts.push(zones.prefix);
  if (zones.castContent) {
    if (parts.length > 0 && !parts[parts.length - 1]?.endsWith("\n")) {
      parts.push("");
    }
    parts.push(zones.castContent);
  }
  if (zones.body) {
    if (parts.length > 0 && zones.castContent && !zones.castContent.endsWith("\n")) {
      parts.push("");
    }
    parts.push(zones.body);
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n");
}
