import { EditorView } from "@codemirror/view";

export const scriptMarkdownCodemirrorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "var(--color-bg-primary)",
      color: "var(--color-text-primary)",
    },
    ".cm-scroller": {
      fontFamily: "var(--script-play-font-family, var(--font-family-script-body))",
      fontSize: "var(--script-font-size-body, 14px)",
      lineHeight: "var(--script-play-line-height, var(--script-markdown-line-height, 1.5))",
      minHeight: "280px",
    },
    ".cm-content": {
      caretColor: "var(--color-text-primary)",
      fontFamily: "inherit",
      fontSize: "inherit",
      lineHeight: "inherit",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "break-word",
    },
    ".cm-line": {
      padding: "0",
      fontFamily: "inherit",
      fontSize: "inherit",
      lineHeight: "inherit",
    },
    ".cm-line.cm-line-para-gap": {
      paddingTop: "var(--script-play-paragraph-gap, var(--script-markdown-paragraph-gap))",
    },
    ".cm-line:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color-text-primary)",
    },
    ".cm-activeLine": {
      backgroundColor: "inherit",
    },
    ".cm-activeLine:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
    },
    ".cm-gutters": { display: "none" },
    ".cm-placeholder": { color: "rgba(148,163,184,0.75)" },
  },
  { dark: true },
);
