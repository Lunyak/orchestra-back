import { cleanOcrText } from "./play-text-ocr";
import { detectFormatWarnings, type FormatWarning } from "./detect-format-warnings";
import { detectCastListRoleNames, formatCastListText } from "./parse-cast-list";
import { joinPlayTextZones, splitPlayTextZones } from "./play-text-zones";
import { filterDetectedRoleNames, isGarbageRoleName, normalizeCastRoleName } from "./role-name-utils";
import {
  buildRoleMarkerLookup,
  canonicalRoleFromLookup,
  expandRoleMarkersForMatch,
  type RoleMarkerSpec,
} from "./role-marker-entries";

export type FormatPlayTextOptions = {
  mergeBrokenLines?: boolean;
  wrapRoleLabels?: boolean;
  roleMarkerLines?: string[];
  /** Роли с псевдонимами для сопоставления в тексте. */
  roleMarkerSpecs?: RoleMarkerSpec[];
  /** Склеить OCR-пробелы в буквах («З о т и к о в и ч»). */
  cleanOcr?: boolean;
  /** Убрать строки FB2/OCR/библиографии. */
  removeOcrNoise?: boolean;
  /** Расставить [[роли]] в блоке «Действующие лица». */
  formatCastList?: boolean;
  /** Не ставить метки на титуле до списка персонажей / первого акта. */
  protectTitlePage?: boolean;
  /** Убрать ведущие/лишние пробелы в строках, чтобы лейблы встали в одну линию. */
  trimExtraSpaces?: boolean;
  /** Убрать точки сразу после лейблов (`[[РОЛЬ]].` / `[[РОЛЬ]] .`). */
  stripLabelDots?: boolean;
};

export type DetectRoleNamesOptions = {
  cleanOcr?: boolean;
  /** Только роли из блока «Действующие лица» (по умолчанию). */
  castListOnly?: boolean;
};

export type FormatPlayTextResult = {
  text: string;
  changed: boolean;
  stats: {
    mergedLines: number;
    labeledLines: number;
    propagatedLines: number;
    matchedMarkers: number;
    inlineSplits: number;
    unmatchedMarkers: string[];
    ocrLinesFixed: number;
    noiseLinesRemoved: number;
    castLinesFormatted: number;
    castRolesFound: number;
    castSplitLines: number;
    trimmedLines: number;
    labelDotsStripped: number;
    warnings: FormatWarning[];
  };
};

function normalizeRole(v: string): string {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

function normalizeSpacedRoleName(raw: string): string {
  const s = normalizeRole(raw);
  if (/^(?:[А-ЯЁA-Zа-яё]\s+){1,}[А-ЯЁA-Zа-яё]$/.test(s)) {
    return s.replace(/\s+/g, "");
  }
  return s;
}

const ROLE_WORD_PATTERN = "[А-ЯЁA-Z][А-ЯЁа-яёA-Za-z0-9 _\\-]{0,39}";
const SPACED_ROLE_PATTERN = "(?:[А-ЯЁA-Zа-яё]\\s+){1,40}[А-ЯЁA-Zа-яё]";
const ROLE_SEPARATOR_PATTERN = "[:.,—\\-]";

function isStageDirectionLine(line: string): boolean {
  const s = String(line ?? "").trim();
  if (!s) return false;
  if (s.startsWith("(")) return true;
  if (s.startsWith("==")) return true;
  if (s.startsWith(">")) return true;
  return false;
}

function parseLineSpeaker(line: string): { role: string; rest: string } | null {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) return null;
  if (parseStandaloneRoleMarkerLine(trimmed)) return null;

  const mBracket = trimmed.match(/^\[\[\s*([^\]]+?)\s*\]\]\s*(.*)$/);
  if (mBracket?.[1]) {
    return { role: normalizeRole(mBracket[1]), rest: String(mBracket[2] ?? "") };
  }

  const mSpaced = trimmed.match(
    new RegExp(`^(${SPACED_ROLE_PATTERN})\\s*(${ROLE_SEPARATOR_PATTERN})?\\s*(.*)$`),
  );
  if (mSpaced?.[1]) {
    const role = normalizeSpacedRoleName(mSpaced[1]);
    if (role.length >= 2) {
      return { role, rest: String(mSpaced[3] ?? "") };
    }
  }

  const mPrefix = trimmed.match(
    new RegExp(`^(${ROLE_WORD_PATTERN})\\s*[:—-]\\s+(.+)$`),
  );
  if (mPrefix?.[1]) {
    return { role: normalizeRole(mPrefix[1]), rest: String(mPrefix[2] ?? "") };
  }

  const mPunct = trimmed.match(
    new RegExp(`^(${ROLE_WORD_PATTERN})\\s*([.,])\\s*(.*)$`),
  );
  if (mPunct?.[1]) {
    const role = normalizeRole(mPunct[1]);
    const rest = String(mPunct[3] ?? "");
    const sep = mPunct[2];
    if (sep === "," && !/^[А-ЯЁA-Z][А-ЯЁA-Z0-9 _.\-]*$/.test(role)) {
      return null;
    }
    if (rest.trim() || role.length >= 3) {
      return { role, rest };
    }
  }

  return null;
}

const STAGE_CUE_ROLES = new Set([
  "занавес",
  "свет",
  "музыка",
  "антракт",
  "аплодисменты",
  "кулисы",
  "пауза",
  "является",
  "сцена",
  "декорация",
  "громко",
  "тише",
  "конец",
  "начало",
]);

function isStageCueRole(role: string): boolean {
  const key = normalizeRole(role)
    .toLowerCase()
    .replace(/ё/g, "е");
  return STAGE_CUE_ROLES.has(key);
}

const STAGE_ACTION_RE =
  /\b(?:врывается|вбегает|выбегает|подбегает|убегает|уходит|входит|выходит|появляется|исчезает|садится|встает|встаёт|встают|берет|берёт|говорит|кричит|шепчет|шепчёт|смеется|смеётся|плачет|плачет|умолкает|замирает|обнимает|целует|умирает|падает|бежит|идет|идёт|стоит|смотрит|поворачивается|отходит|подходит|молчит|слышно|видно|звучит|останавливается|поднимается|опускается|разговаривает|молятся|кланяется|кланяются)\w*\b/i;

const PARTICLE_WORDS = new Set([
  "и",
  "к",
  "в",
  "на",
  "за",
  "из",
  "от",
  "по",
  "с",
  "у",
  "о",
  "об",
  "до",
  "не",
  "а",
  "но",
]);

function looksLikeStageDirectionSentence(text: string): boolean {
  const withoutPeriod = text.replace(/\.\s*$/, "").trim();
  const words = withoutPeriod.split(/\s+/).filter(Boolean);

  if (words.length > 4) return true;
  if (STAGE_ACTION_RE.test(withoutPeriod)) return true;

  if (words.length >= 3 && !/^Голос\s/i.test(withoutPeriod)) {
    if (words.some((word) => PARTICLE_WORDS.has(word.toLowerCase()))) return true;
  }

  return false;
}

/** Строка — только имя персонажа на отдельной строке (Керея. / Первый патриций. / М а н ю ш к а.). */
function parseStandaloneRoleMarkerLine(line: string): string | null {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) return null;
  if (isStageDirectionLine(trimmed)) return null;
  if (isStructuralLine(trimmed)) return null;
  if (/^\[\[/.test(trimmed)) return null;
  if (looksLikeStageDirectionSentence(trimmed)) return null;

  if (/^(?:[А-ЯЁA-Zа-яё]\s+){1,}[А-ЯЁA-Zа-яё]\.?\s*$/.test(trimmed)) {
    const role = normalizeSpacedRoleName(trimmed.replace(/\.\s*$/, ""));
    if (role.length >= 2 && !isStageCueRole(role)) return role;
    return null;
  }

  const withoutPeriod = trimmed.replace(/\.\s*$/, "").trim();
  if (withoutPeriod.length < 2 || withoutPeriod.length > 48) return null;

  const multiWord =
    /^(?:[А-ЯЁA-Z][а-яёa-z]*)(?:\s+[А-ЯЁа-яё][а-яёa-z]*){1,3}$/.test(withoutPeriod);
  const singleWord = /^[А-ЯЁA-Z][А-ЯЁа-яёA-Za-z\-]{1,39}$/.test(withoutPeriod);
  const allCapsWord = /^[А-ЯЁA-Z]{2,}$/.test(withoutPeriod);

  if (!multiWord && !singleWord && !allCapsWord) return null;

  const role = normalizeRole(withoutPeriod);
  if (isStageCueRole(role)) return null;
  return role;
}

function isStandaloneRoleMarker(line: string): boolean {
  return parseStandaloneRoleMarkerLine(line.trim()) !== null;
}

function isSpeakerLine(line: string): boolean {
  const trimmed = line.trim();
  if (isStandaloneRoleMarker(trimmed)) return false;
  return parseLineSpeaker(line) !== null;
}

function isStructuralLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^#{1,3}\s/.test(trimmed)) return true;
  return /^(?:\*\*)?(?:ДЕЙСТВИЕ|АКТ|СЦЕНА|КАРТИН[АУЕЙ]|МИЗАНСЦЕНА)\b/i.test(trimmed);
}

function normalizeLineBreaks(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mergeBrokenLines(text: string): { text: string; mergedCount: number } {
  const lines = text.split("\n");
  const out: string[] = [];
  let buffer: string | null = null;
  let mergedCount = 0;
  let lockLineBreaks = false;

  const flush = () => {
    if (buffer !== null) {
      out.push(buffer);
      buffer = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      lockLineBreaks = false;
      out.push("");
      continue;
    }

    if (isStandaloneRoleMarker(line)) {
      flush();
      out.push(line);
      lockLineBreaks = true;
      continue;
    }

    if (lockLineBreaks) {
      flush();
      out.push(line);
      continue;
    }

    const startsNew =
      isStageDirectionLine(line) ||
      isSpeakerLine(line) ||
      isStructuralLine(line);

    if (startsNew) {
      flush();
      buffer = line;
      continue;
    }

    if (buffer !== null) {
      buffer = `${buffer} ${line}`;
      mergedCount += 1;
    } else {
      buffer = line;
    }
  }

  flush();
  return { text: out.join("\n"), mergedCount };
}

function normalizeMarkerKey(s: string): string {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function lineMatchesRoleMarker(trimmedLine: string, marker: string): boolean {
  const line = normalizeMarkerKey(trimmedLine).toLowerCase();
  const markerTrimmed = normalizeMarkerKey(marker).toLowerCase();
  if (!line || !markerTrimmed) return false;
  if (line === markerTrimmed) return true;
  if (line === `${markerTrimmed}.`) return true;
  if (`${line}.` === markerTrimmed) return true;
  return false;
}

function roleNameFromMarker(markerLine: string): string {
  return parseStandaloneRoleMarkerLine(markerLine) ?? normalizeRole(markerLine.replace(/\.\s*$/, ""));
}

const DIALOGUE_STARTERS = new Set([
  "мы",
  "я",
  "вы",
  "он",
  "она",
  "они",
  "ну",
  "да",
  "нет",
  "что",
  "как",
  "это",
  "вот",
  "ага",
  "ой",
  "ах",
  "ну-ка",
]);

function isLikelyAutoDetectedRoleMarker(trimmed: string): boolean {
  if (!parseStandaloneRoleMarkerLine(trimmed)) return false;

  const firstWord = trimmed.toLowerCase().split(/\s+/)[0] ?? "";
  if (DIALOGUE_STARTERS.has(firstWord)) return false;

  if (/^(?:[А-ЯЁA-Zа-яё]\s+){1,}[А-ЯЁA-Zа-яё]\.?\s*$/.test(trimmed)) return true;

  if (/^[А-ЯЁA-Z]{2,}\.?\s*$/.test(trimmed.replace(/\.\s*$/, ""))) return true;

  if (/^[А-ЯЁA-Z][А-ЯЁа-яёa-z\-]{1,39}\.\s*$/.test(trimmed)) {
    const word = trimmed.replace(/\.\s*$/, "").toLowerCase();
    if (/[йи]те$/.test(word) && word.length > 6) return false;
    if (/^(?:да|нет|ну|ага|ой|ах|увы|стой|молчи|слушай|смотри)/.test(word)) return false;
    return true;
  }

  if (
    /^(?:Первый|Второй|Третий|Четвёртый|Четвертый|Пятый|Шестой|Голос)\s+/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  return false;
}
/** Подсказки для ручного списка меток — строка с именем без реплики на той же строке. */
export function detectRoleMarkerCandidates(text: string): string[] {
  const lines = String(text ?? "").split("\n");
  const out: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!isLikelyAutoDetectedRoleMarker(trimmed)) continue;
    const name = trimmed.replace(/\.\s*$/, "");
    if (isGarbageRoleName(name)) continue;
    out.push(trimmed);
  }

  return Array.from(new Set(out));
}

function escapeRegExp(value: string): string {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeRoleNameInput(name: string): string {
  return normalizeCastRoleName(String(name ?? "").replace(/\.\s*$/, ""));
}

function resolveRoleMarkerSpecs(options: FormatPlayTextOptions): RoleMarkerSpec[] {
  if (options.roleMarkerSpecs?.length) return options.roleMarkerSpecs;
  return (options.roleMarkerLines ?? [])
    .map((name) => ({ name: name.trim(), aliases: [] }))
    .filter((spec) => spec.name);
}

/** «Второй патриций. реплика…» внутри абзаца → отдельные строки с [[РОЛЬ]]. */
function formatInlineRoles(
  text: string,
  roleSpecs: RoleMarkerSpec[],
): { text: string; splitCount: number } {
  const lookup = buildRoleMarkerLookup(roleSpecs);
  const matchNames = expandRoleMarkersForMatch(roleSpecs);
  if (!matchNames.length) return { text, splitCount: 0 };

  const roleAlt = matchNames.map(escapeRegExp).join("|");
  const headerRe = new RegExp(
    `${CYR_BOUNDARY}(${roleAlt})\\s*(\\([^)]*\\))?\\s*\\.`,
    "gi",
  );

  const outLines: string[] = [];
  let splitCount = 0;

  for (const rawLine of text.split("\n")) {
    if (!rawLine.trim()) {
      outLines.push(rawLine);
      continue;
    }

    const matches: Array<{
      role: string;
      remark: string;
      start: number;
      contentStart: number;
    }> = [];

    headerRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = headerRe.exec(rawLine))) {
      if (!match[1]) continue;
      matches.push({
        role: canonicalRoleFromLookup(lookup, match[1]),
        remark: String(match[2] ?? "").trim(),
        start: match.index,
        contentStart: match.index + match[0].length,
      });
    }

    if (!matches.length) {
      outLines.push(rawLine);
      continue;
    }

    for (let i = 0; i < matches.length; i += 1) {
      const current = matches[i];
      const next = matches[i + 1];
      const dialogueEnd = next ? next.start : rawLine.length;
      const dialogue = rawLine
        .slice(current.contentStart, dialogueEnd)
        .replace(/\s+/g, " ")
        .trim();
      const remarkPart = current.remark ? ` ${current.remark}.` : "";
      if (dialogue) {
        outLines.push(`[[${current.role}]]${remarkPart} ${dialogue}`);
      } else {
        outLines.push(`[[${current.role}]]${remarkPart}`);
      }
      splitCount += 1;
    }
  }

  return { text: outLines.join("\n"), splitCount };
}

const CYR_BOUNDARY = "(?<![А-ЯЁа-яёA-Za-z])";
const ORDINAL_PATRICIAN_RE =
  /(?<![А-ЯЁа-яё])((?:Первый|Второй|Третий|Четвёртый|Четвертый|Пятый|Шестой|Старый)\s+патриций)\s*(?:\([^)]*\))?\s*\./gi;

const INLINE_DIALOGUE_WORDS = new Set([
  "конечно",
  "может",
  "жизнь",
  "любовь",
  "печаль",
  "природа",
  "счастью",
  "иногда",
  "вы",
  "я",
  "он",
  "она",
  "это",
  "вот",
  "ну",
  "да",
  "нет",
]);

/** Имена ролей в формате «Имя. реплика» внутри строки. */
export function detectInlineRoleNames(text: string): string[] {
  const out = new Set<string>();

  ORDINAL_PATRICIAN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ORDINAL_PATRICIAN_RE.exec(text))) {
    if (match[1]) out.add(normalizeRole(match[1]));
  }

  const counts = new Map<string, number>();
  const nameRe =
    /(?<![А-ЯЁа-яё])([А-ЯЁA-Z][а-яёa-z]{2,})\s*(?:\([^)]*\))?\s*\./g;
  while ((match = nameRe.exec(text))) {
    const name = normalizeRole(match[1] ?? "");
    const lower = name.toLowerCase();
    if (!name || isStageCueRole(name)) continue;
    if (DIALOGUE_STARTERS.has(lower) || INLINE_DIALOGUE_WORDS.has(lower)) continue;
    if (/^(?:первый|второй|третий|старый|четвертый|четвёртый|пятый|шестой)$/i.test(name)) {
      continue;
    }
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  for (const [name, count] of counts) {
    if (count >= 2) out.add(name);
  }

  return Array.from(out);
}

function preprocessTextForDetection(text: string, cleanOcr: boolean): string {
  if (!cleanOcr) return text;
  return cleanOcrText(text).text;
}

/** Имена ролей для списка в модалке — по умолчанию только «Действующие лица». */
export function detectRoleNamesForFormatting(
  text: string,
  options: DetectRoleNamesOptions = {},
): string[] {
  const cleanOcr = options.cleanOcr !== false;
  const castListOnly = options.castListOnly !== false;
  const source = preprocessTextForDetection(text, cleanOcr);
  const castRoles = detectCastListRoleNames(source);

  if (castListOnly) {
    return filterDetectedRoleNames(castRoles);
  }

  const zones = splitPlayTextZones(source);
  const dialogueText = zones.body || source;
  const inline = detectInlineRoleNames(dialogueText);
  const standalone = detectRoleMarkerCandidates(dialogueText).map((line) =>
    line.replace(/\.\s*$/, ""),
  );

  return filterDetectedRoleNames([...castRoles, ...inline, ...standalone]);
}

/** Есть ли в тексте блок «Действующие лица». */
export function hasCastListSection(text: string, options: DetectRoleNamesOptions = {}): boolean {
  const cleanOcr = options.cleanOcr !== false;
  const source = preprocessTextForDetection(text, cleanOcr);
  return detectCastListRoleNames(source).length > 0;
}

function roleAppearsInText(text: string, marker: string): boolean {
  const role = normalizeRoleNameInput(marker);
  if (!role) return false;

  const lines = String(text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.some((line) => lineMatchesRoleMarker(line, marker))) return true;

  const bracketRe = new RegExp(`\\[\\[\\s*${escapeRegExp(role)}\\s*\\]\\]`, "i");
  if (bracketRe.test(text)) return true;

  const inlineRe = new RegExp(
    `${CYR_BOUNDARY}${escapeRegExp(role)}\\s*(?:\\([^)]*\\))?\\s*\\.`,
    "i",
  );
  return inlineRe.test(text);
}

/** Роли из списка, которых нет в тексте (имя и псевдонимы). */
export function findUnmatchedRoleMarkers(text: string, specs: RoleMarkerSpec[]): string[] {
  if (!specs.length) return [];
  return specs
    .filter((spec) => {
      const variants = [spec.name, ...spec.aliases].filter(Boolean);
      return !variants.some((variant) => roleAppearsInText(text, variant));
    })
    .map((spec) => spec.name);
}

function isInlineSpeakerBreak(line: string, markerList: string[]): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (markerList.some((marker) => lineMatchesRoleMarker(trimmed, marker))) return true;
  if (/^\[\[/.test(trimmed)) return true;
  if (/^[А-ЯЁA-Z][А-ЯЁA-Z0-9 _.\-]{1,40}\s*[:—-]\s+\S/.test(trimmed)) return true;
  return false;
}

function applyRoleMarkerLines(
  text: string,
  roleSpecs: RoleMarkerSpec[],
): { text: string; propagatedLines: number; matchedMarkers: number } {
  const lookup = buildRoleMarkerLookup(roleSpecs);
  const markerList = expandRoleMarkersForMatch(roleSpecs);
  if (!markerList.length) return { text, propagatedLines: 0, matchedMarkers: 0 };

  const lines = text.split("\n");
  const out: string[] = [];
  let currentRole: string | null = null;
  let propagatedLines = 0;
  let matchedMarkers = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i] ?? "";
    const trimmed = rawLine.trim();

    if (!trimmed) {
      currentRole = null;
      out.push(rawLine);
      continue;
    }

    const matchedMarker = markerList.find((marker) => lineMatchesRoleMarker(trimmed, marker));
    if (matchedMarker) {
      currentRole = canonicalRoleFromLookup(lookup, matchedMarker);
      matchedMarkers += 1;

      let hasFollowingDialogue = false;
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = (lines[j] ?? "").trim();
        if (!next) break;
        if (markerList.some((marker) => lineMatchesRoleMarker(next, marker))) break;
        if (isStageDirectionLine(next)) continue;
        hasFollowingDialogue = true;
        break;
      }

      if (!hasFollowingDialogue) {
        const indent = rawLine.match(/^\s*/)?.[0] ?? "";
        out.push(`${indent}[[${currentRole}]]`);
      }
      continue;
    }

    if (
      currentRole &&
      !isStageDirectionLine(trimmed) &&
      !isStructuralLine(trimmed) &&
      !isInlineSpeakerBreak(trimmed, markerList)
    ) {
      if (!/^\[\[/.test(trimmed)) {
        const indent = rawLine.match(/^\s*/)?.[0] ?? "";
        out.push(`${indent}[[${currentRole}]] ${trimmed}`);
        propagatedLines += 1;
        continue;
      }
    }

    const parsed = parseLineSpeaker(trimmed);
    if (parsed) {
      currentRole = normalizeCastRoleName(normalizeSpacedRoleName(parsed.role));
      const indent = rawLine.match(/^\s*/)?.[0] ?? "";
      const rest = parsed.rest.trim();
      if (/^\[\[/.test(trimmed)) {
        out.push(rawLine);
      } else if (rest) {
        out.push(`${indent}[[${currentRole}]] ${rest}`);
      } else {
        out.push(`${indent}[[${currentRole}]]`);
      }
      continue;
    }

    out.push(rawLine);
  }

  return { text: out.join("\n"), propagatedLines, matchedMarkers };
}

function labelRoleLines(text: string): { text: string; labeledCount: number } {
  const lines = text.split("\n");
  let labeledCount = 0;

  const out = lines.map((rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return rawLine;
    if (isStageDirectionLine(trimmed)) return rawLine;
    if (/^\[\[/.test(trimmed)) return rawLine;
    if (isStandaloneRoleMarker(trimmed)) return rawLine;

    const parsed = parseLineSpeaker(trimmed);
    if (!parsed) return rawLine;

    const alreadyBracket = /^\[\[/.test(trimmed);
    if (alreadyBracket) return rawLine;

    labeledCount += 1;
    const indent = rawLine.match(/^\s*/)?.[0] ?? "";
    const role = normalizeCastRoleName(normalizeSpacedRoleName(parsed.role));
    const rest = parsed.rest.trim();
    return rest ? `${indent}[[${role}]] ${rest}` : `${indent}[[${role}]]`;
  });

  return { text: out.join("\n"), labeledCount };
}

function trimExtraLineSpaces(text: string): { text: string; trimmedCount: number } {
  let trimmedCount = 0;
  const out = text.split("\n").map((line) => {
    if (!line) return line;
    const next = line.trim().replace(/\s+/g, " ");
    if (next !== line) trimmedCount += 1;
    return next;
  });
  return { text: out.join("\n"), trimmedCount };
}

function stripDotsAfterLabels(text: string): { text: string; strippedCount: number } {
  let strippedCount = 0;
  const next = text.replace(/(\[\[[^\]]+\]\])\s*\.+/g, (_match, label: string) => {
    strippedCount += 1;
    return label;
  });
  return { text: next, strippedCount };
}

export function formatPlayText(
  source: string,
  options: FormatPlayTextOptions = {},
): FormatPlayTextResult {
  const mergeBroken = options.mergeBrokenLines !== false;
  const wrapLabels = options.wrapRoleLabels !== false;
  const cleanOcr = options.cleanOcr !== false;
  const removeOcrNoise = options.removeOcrNoise === true;
  const formatCast = options.formatCastList !== false;
  const protectTitle = options.protectTitlePage !== false;
  const trimSpaces = options.trimExtraSpaces !== false;
  const stripDots = options.stripLabelDots !== false;
  const roleSpecs = resolveRoleMarkerSpecs(options);

  const original = normalizeLineBreaks(source);
  let text = original;
  let mergedLines = 0;
  let labeledLines = 0;
  let propagatedLines = 0;
  let matchedMarkers = 0;
  let inlineSplits = 0;
  let ocrLinesFixed = 0;
  let noiseLinesRemoved = 0;
  let castLinesFormatted = 0;
  let castRolesFound = 0;
  let castSplitLines = 0;
  let trimmedLines = 0;
  let labelDotsStripped = 0;

  if (cleanOcr) {
    const ocr = cleanOcrText(text, { removeNoiseLines: removeOcrNoise });
    text = ocr.text;
    ocrLinesFixed = ocr.ocrLinesFixed;
    noiseLinesRemoved = ocr.noiseLinesRemoved;
  }

  const zones = splitPlayTextZones(text);
  let prefix = zones.prefix;
  let castContent = zones.castContent;
  let body = zones.body;

  if (formatCast && castContent) {
    const castResult = formatCastListText(castContent);
    castContent = castResult.text;
    castLinesFormatted = castResult.formattedLines;
    castRolesFound = castResult.roles.length;
    castSplitLines = castResult.splitLines;
  }

  if (mergeBroken) {
    if (castContent) {
      const mergedCast = mergeBrokenLines(castContent);
      castContent = mergedCast.text;
      mergedLines += mergedCast.mergedCount;
    }
    if (body) {
      const mergedBody = mergeBrokenLines(body);
      body = mergedBody.text;
      mergedLines += mergedBody.mergedCount;
    }
    if (!protectTitle && prefix) {
      const mergedPrefix = mergeBrokenLines(prefix);
      prefix = mergedPrefix.text;
      mergedLines += mergedPrefix.mergedCount;
    }
  }

  const roleTarget = protectTitle ? body : [prefix, castContent, body].filter(Boolean).join("\n");

  if (roleSpecs.length > 0 && roleTarget) {
    const inline = formatInlineRoles(roleTarget, roleSpecs);
    if (inline.splitCount > 0) {
      if (protectTitle) {
        body = inline.text;
      } else {
        text = inline.text;
        const nextZones = splitPlayTextZones(text);
        prefix = nextZones.prefix;
        castContent = nextZones.castContent;
        body = nextZones.body;
      }
      inlineSplits = inline.splitCount;
    } else {
      const propagated = applyRoleMarkerLines(roleTarget, roleSpecs);
      if (protectTitle) {
        body = propagated.text;
      } else {
        text = propagated.text;
        const nextZones = splitPlayTextZones(text);
        prefix = nextZones.prefix;
        castContent = nextZones.castContent;
        body = nextZones.body;
      }
      propagatedLines = propagated.propagatedLines;
      matchedMarkers = propagated.matchedMarkers;
    }
  }

  if (wrapLabels) {
    if (protectTitle && body) {
      const labeled = labelRoleLines(body);
      body = labeled.text;
      labeledLines = labeled.labeledCount;
    } else if (!protectTitle) {
      const labeled = labelRoleLines([prefix, castContent, body].filter(Boolean).join("\n"));
      text = labeled.text;
      labeledLines = labeled.labeledCount;
      const nextZones = splitPlayTextZones(text);
      prefix = nextZones.prefix;
      castContent = nextZones.castContent;
      body = nextZones.body;
    }
  }

  text = joinPlayTextZones({ prefix, castContent, body });
  if (trimSpaces) {
    const trimmed = trimExtraLineSpaces(text);
    text = trimmed.text;
    trimmedLines = trimmed.trimmedCount;
  }
  if (stripDots) {
    const stripped = stripDotsAfterLabels(text);
    text = stripped.text;
    labelDotsStripped = stripped.strippedCount;
  }
  // Пробел перед ремаркой даёт «дырку» у лейбла; `]](…)` в превью защищается отдельно.
  text = text.replace(/\]\]\s+\(/g, "]](");

  const resolvedUnmatched =
    roleSpecs.length > 0 ? findUnmatchedRoleMarkers(text, roleSpecs) : [];
  const warnings = detectFormatWarnings(text);

  return {
    text,
    changed: text !== original,
    stats: {
      mergedLines,
      labeledLines,
      propagatedLines,
      matchedMarkers,
      inlineSplits,
      unmatchedMarkers: resolvedUnmatched,
      ocrLinesFixed,
      noiseLinesRemoved,
      castLinesFormatted,
      castRolesFound,
      castSplitLines,
      trimmedLines,
      labelDotsStripped,
      warnings,
    },
  };
}
