import type { MarkdownKadrSection } from "../../theater/model/light-kadrs";

const COMMENT_LINE_RE = /^-\s*\*\*Комментарий\*\*:\s*(.*)$/im;
const KADR_FIELD_LINE_RE = /^-\s*\*\*/;

function stripKadrFieldMarkdown(text: string): string {
  return String(text ?? "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/orchestra-image:[^\s]+/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isKadrPlaceholderText(text: string): boolean {
  const value = text.trim();
  if (!value) return true;
  if (/^_/.test(value) && /_$/.test(value)) return true;
  return false;
}

function normalizeCommentLines(text: string): string[] {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatKadrCommentBlock(text: string): string {
  const lines = normalizeCommentLines(text);
  if (lines.length === 0) return "";
  if (lines.length === 1) return `- **Комментарий**: ${lines[0]}`;
  return `- **Комментарий**:\n${lines.join("\n")}`;
}

function readCommentBlockFromSlice(slice: string): string {
  const match = COMMENT_LINE_RE.exec(slice);
  if (!match || match.index == null) return "";

  const inline = match[1]?.trim() ?? "";
  if (inline) return inline;

  const afterLineStart = match.index + match[0].length;
  const rest = slice.slice(afterLineStart);
  const lines: string[] = [];

  for (const rawLine of rest.split("\n")) {
    const line = rawLine.trim();
    if (!line) break;
    if (KADR_FIELD_LINE_RE.test(line)) break;
    lines.push(line);
  }

  return lines.join("\n");
}

export function parseKadrCommentRawInSection(
  markdown: string,
  section: MarkdownKadrSection,
): string {
  const slice = String(markdown ?? "").slice(section.headingEnd, section.sectionEnd);
  return readCommentBlockFromSlice(slice);
}

export function formatKadrCommentForDisplay(raw: string): string {
  const value = stripKadrFieldMarkdown(raw.replace(/\r?\n/g, " "));
  if (!value || isKadrPlaceholderText(value)) return "";
  if (value.length > 240) return `${value.slice(0, 237)}…`;
  return value;
}

export function upsertKadrCommentInSection(
  markdown: string,
  section: MarkdownKadrSection,
  text: string,
): string {
  const trimmed = String(text ?? "").trim();
  const source = String(markdown ?? "");
  const slice = source.slice(section.headingEnd, section.sectionEnd);
  const lineMatch = slice.match(COMMENT_LINE_RE);

  if (!trimmed) {
    if (!lineMatch || lineMatch.index == null) return source;
    const absStart = section.headingEnd + lineMatch.index;
    let absEnd = absStart + lineMatch[0].length;
    const afterLine = source.slice(absEnd);
    const continuation = afterLine.match(/^(?:\n(?!\s*-\s*\*\*)[^\n]+)+/);
    if (continuation?.[0]) absEnd += continuation[0].length;
    if (source[absEnd] === "\n") absEnd += 1;
    return source.slice(0, absStart) + source.slice(absEnd);
  }

  const block = formatKadrCommentBlock(trimmed);
  if (lineMatch && lineMatch.index != null) {
    const absStart = section.headingEnd + lineMatch.index;
    let absEnd = absStart + lineMatch[0].length;
    const afterLine = source.slice(absEnd);
    const continuation = afterLine.match(/^(?:\n(?!\s*-\s*\*\*)[^\n]+)+/);
    if (continuation?.[0]) absEnd += continuation[0].length;
    const suffix = source[absEnd] === "\n" ? "\n" : "";
    return source.slice(0, absStart) + block + suffix + source.slice(absEnd);
  }

  const insertAt = section.sectionEnd;
  const needsLeadingNewline = insertAt > 0 && source[insertAt - 1] !== "\n";
  const prefix = needsLeadingNewline ? "\n" : "";
  return source.slice(0, insertAt) + `${prefix}${block}\n` + source.slice(insertAt);
}
