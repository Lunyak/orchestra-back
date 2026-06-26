import { useMemo, type RefObject } from "react";
import { scanMarkdownKadrSections } from "../../../../features/theater/model/light-kadrs";
import type { ScriptMarkdownEditorHandle } from "../components/ScriptMarkdownCodemirror";

export function isShowScriptKadrLayoutEnabled(markdownMode: string): boolean {
  return markdownMode === "notes" || markdownMode === "explication" || markdownMode === "play";
}

export function buildShowScriptMarkdownTocItems(
  markdown: string,
  enabled: boolean,
): Array<{ level: number; title: string; offset: number }> {
  if (!enabled) return [];
  const text = String(markdown ?? "");
  const re = /^(#{1,3})\s+(.+)$/gm;
  const items: Array<{ level: number; title: string; offset: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const level = m[1]?.length ?? 3;
    const title = String(m[2] ?? "").trim() || "…";
    const offset = Number(m.index) || 0;
    items.push({ level, title, offset });
    if (items.length > 2000) break;
  }
  return items;
}

export function useShowScriptMarkdownToc(args: {
  activeMarkdown: string | undefined;
  markdownMode: string;
}) {
  const { activeMarkdown, markdownMode } = args;
  const kadrLayoutEnabled = isShowScriptKadrLayoutEnabled(markdownMode);

  const hasKadrSections = useMemo(
    () => scanMarkdownKadrSections(String(activeMarkdown ?? "")).length > 0,
    [activeMarkdown],
  );

  const tocItems = useMemo(
    () => buildShowScriptMarkdownTocItems(String(activeMarkdown ?? ""), kadrLayoutEnabled),
    [activeMarkdown, kadrLayoutEnabled],
  );

  const jumpToOffset = (
    offset: number,
    markdownRef: RefObject<ScriptMarkdownEditorHandle | null>,
    fallbackMarkdown: string,
  ) => {
    const ed = markdownRef.current;
    const max = (ed?.getDoc() ?? fallbackMarkdown).length;
    const pos = Math.max(0, Math.min(max, Math.trunc(offset)));
    ed?.focus();
    ed?.setSelection(pos, pos);
  };

  return {
    kadrLayoutEnabled,
    hasKadrSections,
    tocItems,
    jumpToOffset,
  };
}
