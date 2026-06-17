import { fixOcrNameStutter } from "./play-text-ocr";
import {
  isCastDescriptorRole,
  isCastDescriptorToken,
  isCastLineFragment,
} from "./cast-descriptor-words";
import { normalizeCastRoleName, splitRussianCamelCase } from "./role-name-utils";

const CAST_LINE_SKIP_RE =
  /^(?:\*\*)?ДЕЙСТВУЮЩ(?:ИЕ|ИХ)\s+(?:ЛИЦА|ПЕРСОНАЖИ)(?:[:\s]*)$/i;

const VERY_RESPONSIBLE_RE = /^Очень\s+ответственн(?:ая|ый|ое)\s+(.+)$/i;
const NUMBERED_CAST_ROLE_RE = /^\d+-я\s+.+/i;

function escapeRegExp(value: string): string {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function acceptCastRole(name: string): string | null {
  const normalized = normalizeCastRoleName(fixOcrNameStutter(name));
  if (!normalized || isCastDescriptorRole(normalized)) return null;
  return normalized;
}

/** Одно имя: заглавные слова до описания или возраста. */
function extractSingleCastRoleName(text: string): string | null {
  const words = splitRussianCamelCase(text).split(/\s+/).filter(Boolean);
  const nameWords: string[] = [];

  for (const rawWord of words) {
    const word = rawWord.replace(/[,.;]+$/g, "");
    if (!word) continue;
    if (isCastDescriptorToken(word)) break;
    if (nameWords.length > 0 && /^[а-яё]/.test(word)) break;
    if (!/^[А-ЯЁ]/.test(word)) break;
    nameWords.push(word);
    if (nameWords.length >= 6) break;
  }

  return acceptCastRole(nameWords.join(" "));
}

function splitCastNameParts(text: string): string[] {
  const normalized = splitRussianCamelCase(text).trim();
  const alsoParts = normalized.split(/\s+он\s+же\s+/i).map((part) => part.trim()).filter(Boolean);
  const out: string[] = [];

  for (const alsoPart of alsoParts) {
    const andMatch = alsoPart.match(/^(.+?)\s+и\s+(.+)$/i);
    if (andMatch?.[1] && andMatch[2]) {
      const left = andMatch[1].trim();
      const right = andMatch[2].trim();
      if (/^[А-ЯЁ]/.test(left) && /^[А-ЯЁ]/.test(right)) {
        out.push(left, right);
        continue;
      }
    }
    out.push(alsoPart.replace(/,.*$/, "").trim());
  }

  return out;
}

function extractRolesFromCastText(text: string): string[] {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return [];

  if (NUMBERED_CAST_ROLE_RE.test(trimmed)) {
    const role = acceptCastRole(trimmed.replace(/(ная|ный|ное)\s*(дама|дам)/i, "$1 $2"));
    return role ? [role] : [];
  }

  const veryMatch = trimmed.match(VERY_RESPONSIBLE_RE);
  if (veryMatch?.[1]) {
    const role = extractSingleCastRoleName(veryMatch[1]);
    return role ? [role] : [];
  }

  const parts = splitCastNameParts(trimmed);
  const roles: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const role = extractSingleCastRoleName(part);
    if (!role) continue;
    const key = role.toLowerCase().replace(/ё/g, "е");
    if (seen.has(key)) continue;
    seen.add(key);
    roles.push(role);
  }

  return roles;
}

function extractCastDescription(text: string, roles: string[]): string {
  let remainder = splitRussianCamelCase(text).trim();
  for (let pass = 0; pass < roles.length + 1; pass += 1) {
    for (const role of roles) {
      remainder = remainder.replace(new RegExp(`^${escapeRegExp(role)}\\s*`, "i"), "");
    }
    remainder = remainder
      .replace(/^(?:и|он\s+же)\s+/gi, "")
      .replace(/^,\s*/, "")
      .trim();
  }
  return remainder.replace(/\s+/g, " ").trim();
}

/** Режет плотную строку списка персонажей на отдельные записи. */
export function splitCompoundCastSegments(line: string): string[] {
  let text = String(line ?? "").trim();
  if (!text) return [];

  const segments: string[] = [];
  const bracketMatch = text.match(/^(\[\[\s*[^\]]+\s*\]\])\s*(.*)$/);
  if (bracketMatch?.[1]) {
    segments.push(bracketMatch[1].trim());
    text = String(bracketMatch[2] ?? "").trim();
  }

  if (!text) return segments;

  const veryIdx = text.search(/\s+Очень\s+ответственн/i);
  if (veryIdx > 0) {
    segments.push(text.slice(0, veryIdx).trim());
    text = text.slice(veryIdx).trim();
  }

  const numberedParts = text
    .split(/\.\s+(?=\d+-я(?:\s|$))/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (numberedParts.length > 1) {
    segments.push(...numberedParts);
    return segments.filter(Boolean);
  }

  const dotParts = text
    .split(/\.\s+(?=(?:Очень\s+ответственн|\d+-я(?:\s|$)))/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (dotParts.length > 1) {
    segments.push(...dotParts);
    return segments.filter(Boolean);
  }

  segments.push(text);
  return segments.filter(Boolean);
}

function parseCastSegment(segment: string): { roles: string[]; description: string } | null {
  const trimmed = String(segment ?? "").trim().replace(/\.\s*$/, "");
  if (!trimmed) return null;

  const bracketOnly = trimmed.match(/^\[\[\s*([^\]]+?)\s*\]\]$/);
  if (bracketOnly?.[1]) {
    const role = acceptCastRole(bracketOnly[1]);
    return role ? { roles: [role], description: "" } : null;
  }

  const veryMatch = trimmed.match(VERY_RESPONSIBLE_RE);
  if (veryMatch) {
    const roles = extractRolesFromCastText(trimmed);
    if (!roles.length) return null;
    return { roles, description: "очень ответственная" };
  }

  const roles = extractRolesFromCastText(trimmed);
  if (!roles.length) return null;

  const description = extractCastDescription(trimmed, roles);
  return { roles, description };
}

function formatParsedCastEntry(parsed: { roles: string[]; description: string }): string {
  const labels = parsed.roles.map((role) => `[[${role}]]`).join(" ");
  return parsed.description ? `${labels} ${parsed.description}` : labels;
}

function formatCastLine(line: string): { lines: string[]; roles: string[] } | null {
  const trimmed = String(line ?? "").trim();
  if (!trimmed || CAST_LINE_SKIP_RE.test(trimmed)) return null;
  if (isCastLineFragment(trimmed)) return null;

  const segments = splitCompoundCastSegments(trimmed);
  if (!segments.length) return null;

  const outputLines: string[] = [];
  const roles: string[] = [];
  const roleKeys = new Set<string>();

  const pushParsed = (parsed: { roles: string[]; description: string }) => {
    outputLines.push(formatParsedCastEntry(parsed));
    for (const role of parsed.roles) {
      const key = role.toLowerCase().replace(/ё/g, "е");
      if (roleKeys.has(key)) continue;
      roleKeys.add(key);
      roles.push(role);
    }
  };

  for (const segment of segments) {
    const parsed = parseCastSegment(segment);
    if (!parsed?.roles.length) return null;
    pushParsed(parsed);
  }

  if (!outputLines.length) return null;
  return { lines: outputLines, roles };
}

/** Склеивает обрывки вроде «38» + «лет» с предыдущей строкой. */
function mergeCastLineFragments(lines: string[]): string[] {
  const out: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      out.push(rawLine);
      continue;
    }

    if (isCastLineFragment(trimmed) && out.length > 0) {
      const prevIndex = out.length - 1;
      const prev = out[prevIndex] ?? "";
      const joiner = prev.endsWith(" ") || prev.endsWith("-") ? "" : " ";
      out[prevIndex] = `${prev}${joiner}${trimmed}`;
      continue;
    }

    out.push(rawLine);
  }

  return out;
}

export type FormatCastListResult = {
  text: string;
  roles: string[];
  formattedLines: number;
  splitLines: number;
};

/** Форматирует блок «Действующие лица»: [[Имя]] описание. */
export function formatCastListText(castContent: string): FormatCastListResult {
  const mergedLines = mergeCastLineFragments(String(castContent ?? "").split("\n"));
  const out: string[] = [];
  const roles: string[] = [];
  const roleKeys = new Set<string>();
  let formattedLines = 0;
  let splitLines = 0;

  for (const rawLine of mergedLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      out.push(rawLine);
      continue;
    }

    if (isCastLineFragment(trimmed)) {
      out.push(rawLine);
      continue;
    }

    const formatted = formatCastLine(trimmed);
    if (!formatted) {
      out.push(rawLine);
      continue;
    }

    const indent = rawLine.match(/^\s*/)?.[0] ?? "";
    for (const formattedLine of formatted.lines) {
      out.push(`${indent}${formattedLine}`);
    }
    formattedLines += 1;
    if (formatted.lines.length > 1) splitLines += formatted.lines.length - 1;

    for (const role of formatted.roles) {
      const key = role.toLowerCase().replace(/ё/g, "е");
      if (roleKeys.has(key)) continue;
      roleKeys.add(key);
      roles.push(role);
    }
  }

  return { text: out.join("\n"), roles, formattedLines, splitLines };
}

/** Имена из блока «Действующие лица» для списка в модалке. */
export function detectCastListRoleNames(text: string): string[] {
  const mergedLines = mergeCastLineFragments(String(text ?? "").split("\n"));
  let inCast = false;
  const roles: string[] = [];
  const roleKeys = new Set<string>();

  for (const rawLine of mergedLines) {
    const trimmed = rawLine.trim();
    if (CAST_LINE_SKIP_RE.test(trimmed)) {
      inCast = true;
      continue;
    }
    if (!inCast) continue;
    if (/^(?:\*\*)?(?:АКТ|СЦЕНА|КАРТИН[АУЕЙ]|ДЕЙСТВИЕ)(?:\s|$|[.:])/i.test(trimmed)) break;

    const formatted = formatCastLine(trimmed);
    if (!formatted) continue;
    for (const role of formatted.roles) {
      const key = role.toLowerCase().replace(/ё/g, "е");
      if (roleKeys.has(key)) continue;
      roleKeys.add(key);
      roles.push(role);
    }
  }

  return roles;
}
