import { RangeSetBuilder, StateField, type Text } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { isLightKadrAnchorLine } from "../../../../features/theater/model/light-kadrs";

function buildHiddenAnchorDecorations(doc: Text): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  for (let n = 1; n <= doc.lines; n += 1) {
    const line = doc.line(n);
    if (!isLightKadrAnchorLine(line.text)) continue;
    b.add(line.from, line.from, Decoration.line({ class: "cm-lk-anchor-hidden" }));
  }
  return b.finish();
}

/** Скрыть строки `<!-- lk:… -->` в редакторе (данные в документе сохраняются). */
export function markdownHideKadrAnchors(getEnabled: () => boolean) {
  return StateField.define<DecorationSet>({
    create(state) {
      if (!getEnabled()) return Decoration.none;
      return buildHiddenAnchorDecorations(state.doc);
    },
    update(value, tr) {
      if (!getEnabled()) return Decoration.none;
      if (!tr.docChanged) {
        if (value === Decoration.none) {
          return buildHiddenAnchorDecorations(tr.state.doc);
        }
        return value;
      }
      return buildHiddenAnchorDecorations(tr.state.doc);
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}
