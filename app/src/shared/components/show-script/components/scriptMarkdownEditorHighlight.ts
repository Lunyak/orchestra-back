import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const body = "var(--color-text-primary)";

/**
 * Подсветка Markdown в редакторе сценария — те же оттенки, что у `.markdown-preview`
 * и `.cm-md-heading-body` (заголовки кадра / сценария).
 */
export const scriptMarkdownEditorSyntaxHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading1, color: "#f8fafc", fontWeight: "700" },
    { tag: tags.heading2, color: "#f8fafc", fontWeight: "700" },
    { tag: tags.heading3, color: "#e78a4e", fontWeight: "700" },
    { tag: tags.heading4, color: "#fdba74", fontWeight: "700" },
    { tag: tags.heading5, color: "#fdba74", fontWeight: "700" },
    { tag: tags.heading6, color: "#fdba74", fontWeight: "700" },
    { tag: tags.heading, color: "#f8fafc", fontWeight: "700" },
    { tag: tags.processingInstruction, color: "rgba(148, 163, 184, 0.5)" },
    { tag: tags.meta, color: "rgba(148, 163, 184, 0.55)" },
    { tag: tags.labelName, color: "rgba(148, 163, 184, 0.88)" },
    { tag: tags.string, color: "rgba(203, 213, 225, 0.95)" },
    { tag: tags.url, color: "rgba(147, 197, 253, 0.92)" },
    { tag: tags.link, color: "#93c5fd" },
    { tag: tags.emphasis, fontStyle: "italic", color: body },
    { tag: tags.strong, fontWeight: "700", color: body },
    {
      tag: tags.monospace,
      color: "#e2e8f0",
      fontWeight: "600",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: "0.92em",
    },
    { tag: tags.quote, fontStyle: "italic", color: body },
    { tag: tags.list, color: body },
    { tag: tags.contentSeparator, color: "rgba(148, 163, 184, 0.45)" },
    {
      tag: tags.strikethrough,
      textDecoration: "line-through",
      color: "rgba(148, 163, 184, 0.88)",
    },
    { tag: tags.comment, color: "rgba(100, 116, 139, 0.88)", fontStyle: "italic" },
    { tag: tags.escape, color: "rgba(148, 163, 184, 0.9)" },
    { tag: tags.character, color: body },
    { tag: tags.content, color: body },
  ]),
  { fallback: true },
);
