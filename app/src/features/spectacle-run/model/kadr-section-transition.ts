import type { MarkdownKadrSection } from "../../theater/model/light-kadrs";
import { stripImageMarkdownFromTransitionLineValue } from "./kadr-section-image";

const TRANSITION_LINE_RE = /^-\s*\*\*Переход\*\*:\s*([^\n]*)/im;

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

export function formatKadrTransitionLine(text: string): string {
  const trimmed = stripImageMarkdownFromTransitionLineValue(text);
  if (!trimmed) return "- **Переход**:";
  return `- **Переход**: ${trimmed}`;
}

export function parseKadrTransitionRawInSection(
  markdown: string,
  section: MarkdownKadrSection,
): string {
  const slice = String(markdown ?? "").slice(section.headingEnd, section.sectionEnd);
  const match = TRANSITION_LINE_RE.exec(slice);
  const raw = match?.[1]?.trim() ?? "";
  return stripImageMarkdownFromTransitionLineValue(raw);
}

export function formatKadrTransitionForDisplay(raw: string): string {
  const value = stripKadrFieldMarkdown(raw);
  if (!value || isKadrPlaceholderText(value)) return "";
  if (value.length > 120) return `${value.slice(0, 117)}…`;
  return value;
}

export function upsertKadrTransitionInSection(
  markdown: string,
  section: MarkdownKadrSection,
  text: string,
): string {
  const trimmed = stripImageMarkdownFromTransitionLineValue(text);
  const source = String(markdown ?? "");
  const slice = source.slice(section.headingEnd, section.sectionEnd);
  const lineMatch = slice.match(TRANSITION_LINE_RE);

  if (!trimmed) {
    if (!lineMatch || lineMatch.index == null) return source;
    const absStart = section.headingEnd + lineMatch.index;
    let absEnd = absStart + lineMatch[0].length;
    if (source[absEnd] === "\n") absEnd += 1;
    return source.slice(0, absStart) + source.slice(absEnd);
  }

  const line = formatKadrTransitionLine(trimmed);
  if (lineMatch && lineMatch.index != null) {
    const absStart = section.headingEnd + lineMatch.index;
    const absEnd = absStart + lineMatch[0].length;
    return source.slice(0, absStart) + line + source.slice(absEnd);
  }

  const insertAt = section.sectionEnd;
  const needsLeadingNewline = insertAt > 0 && source[insertAt - 1] !== "\n";
  const prefix = needsLeadingNewline ? "\n" : "";
  return source.slice(0, insertAt) + `${prefix}${line}\n` + source.slice(insertAt);
}
