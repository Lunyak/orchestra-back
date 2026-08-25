import { type Extension, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { findMarkdownSearchMatches } from "../../app-editor-menubar/script-tokenize-formatting";

export const setFormatSearchQueryEffect = StateEffect.define<string>();

const formatSearchMatchMark = Decoration.mark({ class: "cm-format-search-match" });

function buildFormatSearchDecorations(doc: string, query: string): DecorationSet {
  const ranges = findMarkdownSearchMatches(doc, query);
  if (ranges.length === 0) return Decoration.none;
  return Decoration.set(
    ranges.map((range) => formatSearchMatchMark.range(range.from, range.to)),
    true,
  );
}

const formatSearchQueryField = StateField.define<string>({
  create() {
    return "";
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setFormatSearchQueryEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

const formatSearchDecorations = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, transaction) {
    let query = transaction.state.field(formatSearchQueryField);
    let queryChanged = false;

    for (const effect of transaction.effects) {
      if (effect.is(setFormatSearchQueryEffect)) {
        query = effect.value;
        queryChanged = true;
      }
    }

    if (queryChanged || transaction.docChanged) {
      return buildFormatSearchDecorations(transaction.state.doc.toString(), query);
    }

    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const formatSearchHighlightTheme = EditorView.baseTheme({
  ".cm-format-search-match": {
    backgroundColor: "var(--color-highlight-yellow)",
    outline: "1px solid var(--color-highlight-yellow-outline)",
  },
});

export const markdownFormatSearchHighlight: Extension = [
  formatSearchQueryField,
  formatSearchDecorations,
  formatSearchHighlightTheme,
];

export function dispatchFormatSearchQuery(view: EditorView, query: string) {
  view.dispatch({
    effects: setFormatSearchQueryEffect.of(query),
  });
}
