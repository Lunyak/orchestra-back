import {
  scanMarkdownKadrSections,
  type MarkdownKadrSection,
} from "../../theater/model/light-kadrs";
import { findFirstMarkdownImageHref } from "../../../shared/utils/markdownImages";

const TRANSITION_LINE_RE = /^-\s*\*\*Переход\*\*:\s*(.*)$/im;
const STANDALONE_IMAGE_LINE_RE = /^\s*!\[[^\]]*\]\s*\([^)]+\)\s*$/;
const IMAGE_MARKDOWN_RE = /!\[[^\]]*\]\s*\([^)]+\)/g;

export function findFirstKadrSectionImageHref(
  markdown: string,
  section: MarkdownKadrSection | null | undefined,
): string | null {
  if (!section) return null;
  const body = sectionBodyWithoutTransitionLine(markdown, section);
  return findFirstMarkdownImageHref(body);
}

function sectionBodyWithoutTransitionLine(
  markdown: string,
  section: MarkdownKadrSection,
): string {
  const slice = String(markdown ?? "").slice(section.headingEnd, section.sectionEnd);
  return slice.replace(TRANSITION_LINE_RE, "");
}

export function parseKadrSectionImageMarkdownInSection(
  markdown: string,
  section: MarkdownKadrSection,
): string {
  const slice = String(markdown ?? "").slice(section.headingEnd, section.sectionEnd);
  const snippets: string[] = [];
  const transitionMatch = TRANSITION_LINE_RE.exec(slice);
  const transitionValue = transitionMatch?.[1] ?? "";
  if (transitionValue) {
    const embedded = transitionValue.match(IMAGE_MARKDOWN_RE);
    if (embedded) snippets.push(...embedded);
  }
  for (const line of sectionBodyWithoutTransitionLine(markdown, section).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (STANDALONE_IMAGE_LINE_RE.test(trimmed)) {
      snippets.push(trimmed);
    }
  }
  return snippets.join("\n").trim();
}

export function stripKadrSectionStandaloneImages(
  markdown: string,
  section: MarkdownKadrSection,
): string {
  const source = String(markdown ?? "");
  const slice = source.slice(section.headingEnd, section.sectionEnd);
  const lines = slice.split("\n");
  const kept = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (TRANSITION_LINE_RE.test(line)) return true;
    return !STANDALONE_IMAGE_LINE_RE.test(trimmed);
  });
  const nextSlice = kept.join("\n");
  return source.slice(0, section.headingEnd) + nextSlice + source.slice(section.sectionEnd);
}

export function stripImageMarkdownFromTransitionLineValue(value: string): string {
  const withoutImages = String(value ?? "").replace(IMAGE_MARKDOWN_RE, " ");
  return withoutImages.replace(/\s+/g, " ").trim();
}

export function insertKadrSectionImageAfterTransition(
  markdown: string,
  section: MarkdownKadrSection,
  imageMarkdown: string,
): string {
  const snippet = imageMarkdown.trim();
  if (!snippet) return markdown;

  const source = stripKadrSectionStandaloneImages(markdown, section);
  const refreshed = scanSectionInMarkdown(source, section);
  if (!refreshed) return source;

  const slice = source.slice(refreshed.headingEnd, refreshed.sectionEnd);
  const transitionMatch = TRANSITION_LINE_RE.exec(slice);

  let insertAt = refreshed.sectionEnd;
  if (transitionMatch && transitionMatch.index != null) {
    const lineEnd = refreshed.headingEnd + transitionMatch.index + transitionMatch[0].length;
    insertAt = lineEnd;
    while (insertAt < refreshed.sectionEnd && source[insertAt] === "\n") {
      insertAt += 1;
    }
  }

  const needsLeadingNewline = insertAt > 0 && source[insertAt - 1] !== "\n";
  const prefix = needsLeadingNewline ? "\n" : "";
  return `${source.slice(0, insertAt)}${prefix}\n\n${snippet}\n${source.slice(insertAt)}`;
}

function scanSectionInMarkdown(
  markdown: string,
  section: MarkdownKadrSection,
): MarkdownKadrSection | null {
  const sections = scanMarkdownKadrSections(markdown);
  if (section.id) {
    return sections.find((row) => row.id === section.id) ?? null;
  }
  return sections.find((row) => row.kadrNo === section.kadrNo) ?? null;
}
