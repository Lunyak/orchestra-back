import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const body = "var(--script-play-text-color, var(--color-text-primary))";

/**
 * Подсветка Markdown в редакторе сценария — те же оттенки, что у `.markdown-preview`
 * и `.cm-md-heading-body` (заголовки кадра / сценария).
 */
export const scriptMarkdownEditorSyntaxHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading1, color: "var(--color-text-bright)", fontWeight: "700" },
    { tag: tags.heading2, color: "var(--color-text-bright)", fontWeight: "700" },
    { tag: tags.heading3, color: "var(--color-script-accent)", fontWeight: "700" },
    { tag: tags.heading4, color: "var(--color-script-heading-warm)", fontWeight: "700" },
    { tag: tags.heading5, color: "var(--color-script-heading-warm)", fontWeight: "700" },
    { tag: tags.heading6, color: "var(--color-script-heading-warm)", fontWeight: "700" },
    { tag: tags.heading, color: "var(--color-text-bright)", fontWeight: "700" },
    { tag: tags.processingInstruction, color: "var(--color-text-dim-alpha)" },
    { tag: tags.meta, color: "var(--color-text-muted-alpha)" },
    { tag: tags.labelName, color: "var(--color-text-muted-strong)" },
    { tag: tags.string, color: "var(--color-text-slate-strong)" },
    { tag: tags.url, color: "var(--color-link-alpha)" },
    { tag: tags.link, color: "var(--color-script-link)" },
    { tag: tags.emphasis, fontStyle: "italic", color: body },
    { tag: tags.strong, fontWeight: "700", color: body },
    {
      tag: tags.monospace,
      color: "var(--color-text-ui)",
      fontWeight: "600",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: "0.92em",
    },
    { tag: tags.quote, fontStyle: "italic", color: body },
    { tag: tags.list, color: body },
    { tag: tags.contentSeparator, color: "var(--scrollbar-thumb)" },
    {
      tag: tags.strikethrough,
      textDecoration: "line-through",
      color: "var(--color-text-muted-strong)",
    },
    { tag: tags.comment, color: "var(--color-text-dimmer-alpha)", fontStyle: "italic" },
    { tag: tags.escape, color: "var(--color-text-muted-high)" },
    { tag: tags.character, color: body },
    { tag: tags.content, color: body },
  ]),
  { fallback: true },
);
