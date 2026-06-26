import { EditorView } from "@codemirror/view";

export const scriptMarkdownCodemirrorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "var(--color-bg-primary)",
      color: "var(--color-text-primary)",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-family-script-body)",
      fontSize: "14px",
      lineHeight: "1.5",
      minHeight: "280px",
    },
    ".cm-content": {
      caretColor: "var(--color-text-primary)",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "break-word",
    },
    ".cm-line": {
      padding: 0,
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color-text-primary)",
    },
    ".cm-activeLine": {
      backgroundColor: "inherit",
    },
    ".cm-gutters": { display: "none" },
    ".cm-placeholder": { color: "rgba(148,163,184,0.75)" },
  },
  { dark: true },
);
