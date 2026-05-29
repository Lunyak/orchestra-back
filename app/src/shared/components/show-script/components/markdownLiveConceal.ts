import { syntaxTree } from "@codemirror/language";
import { EditorState, RangeSetBuilder, type Extension, type SelectionRange } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

const CONCEAL_NODE = new Set([
  "EmphasisMark",
  "CodeMark",
  // HeaderMark: префикс #… обрабатывается в orchestraEditorRichTokens (чип), не дублируем conceal
  "LinkMark",
  "ListMark",
  "QuoteMark",
]);

function intersectsRange(sel: SelectionRange, from: number, to: number): boolean {
  return sel.from < to && sel.to > from;
}

function cursorInside(sel: SelectionRange, from: number, to: number): boolean {
  return !sel.empty ? intersectsRange(sel, from, to) : sel.from >= from && sel.from <= to;
}

/** Показать маркер, если каретка/выделение внутри «контейнера» (как в Live Preview Obsidian). */
function shouldRevealMark(
  state: EditorState,
  markFrom: number,
  markTo: number,
  sel: SelectionRange,
): boolean {
  if (cursorInside(sel, markFrom, markTo)) return true;
  if (!sel.empty) return intersectsRange(sel, markFrom, markTo);

  const pos = sel.from;
  let n: SyntaxNode | null = syntaxTree(state).resolveInner(markFrom + 1, -1);
  while (n) {
    const name = n.name;
    if (
      name === "StrongEmphasis" ||
      name === "Emphasis" ||
      name === "Link" ||
      name === "Image" ||
      name === "InlineCode" ||
      name === "FencedCode" ||
      name === "Blockquote" ||
      name === "ListItem" ||
      /^ATXHeading\d?$/.test(name)
    ) {
      return pos >= n.from && pos <= n.to;
    }
    n = n.parent;
  }
  return false;
}

function buildConcealSet(view: EditorView): DecorationSet {
  const state = view.state;
  const sel = state.selection.main;
  const tree = syntaxTree(state);
  const b = new RangeSetBuilder<Decoration>();

  for (const { from: vFrom, to: vTo } of view.visibleRanges) {
    tree.iterate({
      from: vFrom,
      to: vTo,
      enter: (node) => {
        if (!CONCEAL_NODE.has(node.name)) return;
        if (shouldRevealMark(state, node.from, node.to, sel)) return;
        b.add(
          node.from,
          node.to,
          Decoration.mark({ class: "cm-md-concealed" }),
        );
      },
    });
  }

  return b.finish();
}

const concealPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(readonly view: EditorView) {
      this.decorations = buildConcealSet(this.view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildConcealSet(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const concealTheme = EditorView.baseTheme({
  ".cm-md-concealed": {
    opacity: "0.22",
    caretColor: "var(--color-text-primary)",
  },
});

/**
 * Скрывает (приглушает) маркеры Markdown, пока каретка не внутри блока —
 * первый шаг к поведению Obsidian Live Preview.
 */
export function markdownLiveConceal(): Extension {
  return [concealPlugin, concealTheme];
}
