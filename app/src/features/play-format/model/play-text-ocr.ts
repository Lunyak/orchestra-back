const SINGLE_CYR = /^[А-ЯЁа-яё]$/;

const OCR_NOISE_LINE_RE =
  /^[-=_─—]{8,}$|(?:\bOCR\b|\[\[Fb2\]\]|\bFb2\b|Leshka|собрание\s+сочинений|художественная\s+литература)/i;

export function isOcrNoiseLine(line: string): boolean {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) return false;
  if (OCR_NOISE_LINE_RE.test(trimmed)) return true;
  if (/^[-=_─—\s]{12,}$/.test(trimmed)) return true;
  return false;
}

/** Убирает типичный OCR-мусор «и м Зотикович». */
function removeStrayOcrLetterM(line: string): string {
  return String(line ?? "").replace(/\s+и\s+м(?=\s+[А-ЯЁ](?:\s+[А-ЯЁа-яё]){2,})/g, " и");
}

function normalizeCollapsedWord(tokens: string[]): string {
  const compact = tokens.join("");
  return compact.charAt(0).toUpperCase() + compact.slice(1).toLowerCase();
}

function readSpacedLetterRun(line: string, start: number): { end: number; tokens: string[] } | null {
  let index = start;
  while (line[index] === " ") index += 1;
  if (index >= line.length) return null;

  const first = line[index];
  if (!first || !SINGLE_CYR.test(first) || !/[А-ЯЁ]/.test(first)) return null;

  const tokens = [first];
  index += 1;

  while (index < line.length) {
    if (line[index] === " ") {
      index += 1;
      if (line[index] === "-") {
        index += 1;
        while (line[index] === " ") index += 1;
      }
      const next = line[index];
      if (!next || !SINGLE_CYR.test(next)) break;
      tokens.push(next);
      index += 1;
      continue;
    }
    break;
  }

  if (tokens.length < 3) return null;
  return { end: index, tokens };
}

/** «З о т и к о в и ч» → «Зотикович», «Д з а - Л и н» → «Дзалин». */
export function collapseSpacedLettersInLine(line: string): string {
  const source = removeStrayOcrLetterM(line);
  let out = "";
  let index = 0;

  while (index < source.length) {
    const run = readSpacedLetterRun(source, index);
    if (!run) {
      out += source[index];
      index += 1;
      continue;
    }

    const normalized = normalizeCollapsedWord(run.tokens);
    if (out && /[А-ЯЁа-яё]$/.test(out) && /^[А-ЯЁ]/.test(normalized)) {
      out += " ";
    }
    out += normalized;
    index = run.end;
  }

  return out
    .replace(
      /\.\s+(\d+-я)\s+((?:[а-яёА-ЯЁ](?:\s+)){2,}[а-яёА-ЯЁ])/gi,
      (_, ordinal: string, spaced: string) => {
        const tokens = spaced.trim().split(/\s+/).filter(Boolean);
        if (!tokens.every((token) => SINGLE_CYR.test(token))) {
          return `. ${ordinal} ${spaced}`;
        }
        const word = tokens.join("");
        const normalized = word
          .replace(/(ная|ный|ное)(дама|дам)$/i, "$1 $2")
          .toLowerCase();
        return `. ${ordinal} ${normalized}`;
      },
    )
    .replace(
      /^(\d+-я)\s+((?:[а-яёА-ЯЁ](?:\s+)){2,}[а-яёА-ЯЁ])(?=\s*\.|$)/i,
      (_, ordinal: string, spaced: string) => {
        const tokens = spaced.trim().split(/\s+/).filter(Boolean);
        if (!tokens.every((token) => SINGLE_CYR.test(token))) return `${ordinal} ${spaced}`;
        const word = tokens
          .join("")
          .replace(/(ная|ный|ное)(дама|дам)$/i, "$1 $2")
          .toLowerCase();
        return `${ordinal} ${word}`;
      },
    )
    .replace(/(безответственн(?:ая|ые))(дама|дам)/gi, "$1 $2");
}

export function shouldCollapseSpacedLetters(line: string): boolean {
  return collapseSpacedLettersInLine(line) !== line;
}

/** Убирает OCR-хвост «мЗотикович» → «Зотикович». */
export function fixOcrNameStutter(name: string): string {
  return String(name ?? "")
    .trim()
    .replace(/^([а-яё])([А-ЯЁ][а-яё]+)/, "$2");
}

export type CleanOcrTextOptions = {
  removeNoiseLines?: boolean;
};

export type CleanOcrTextResult = {
  text: string;
  ocrLinesFixed: number;
  noiseLinesRemoved: number;
};

export function cleanOcrText(
  text: string,
  options: CleanOcrTextOptions = {},
): CleanOcrTextResult {
  const removeNoise = options.removeNoiseLines === true;
  const lines = String(text ?? "").split("\n");
  const out: string[] = [];
  let ocrLinesFixed = 0;
  let noiseLinesRemoved = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (removeNoise && trimmed && isOcrNoiseLine(trimmed)) {
      noiseLinesRemoved += 1;
      continue;
    }

    const collapsed = collapseSpacedLettersInLine(rawLine);
    if (collapsed !== rawLine) ocrLinesFixed += 1;
    out.push(collapsed);
  }

  return {
    text: out.join("\n"),
    ocrLinesFixed,
    noiseLinesRemoved,
  };
}
