import { RangeSetBuilder, StateField, type Text } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

const HEADING_LINE_RE = /^\s{0,3}(#{1,3})(?:\s+|\s*$)/u;
const FENCE_LINE_RE = /^\s{0,3}```/;

function isHeadingLine(text: string, maxLevel: number): number | null {
  if (FENCE_LINE_RE.test(text)) return null;
  const m = HEADING_LINE_RE.exec(text);
  if (!m) return null;
  const level = m[1].length;
  return level <= maxLevel ? level : null;
}

function buildHeadingSectionDecorations(doc: Text, maxLevel: number): DecorationSet {
  type Section = { fromLine: number; toLine: number };
  const sections: Section[] = [];
  let current: Section | null = null;

  for (let n = 1; n <= doc.lines; n += 1) {
    const line = doc.line(n);
    const level = isHeadingLine(line.text, maxLevel);
    if (level != null) {
      if (current) sections.push(current);
      current = { fromLine: n, toLine: n };
      continue;
    }
    if (current) current.toLine = n;
  }
  if (current) sections.push(current);

  const b = new RangeSetBuilder<Decoration>();
  for (const section of sections) {
    for (let n = section.fromLine; n <= section.toLine; n += 1) {
      const line = doc.line(n);
      const classes = ["cm-kadr-section-line"];
      if (n === section.fromLine) classes.push("cm-kadr-section-line--first");
      if (n === section.toLine) classes.push("cm-kadr-section-line--last");
      if (isHeadingLine(line.text, maxLevel) != null) classes.push("cm-kadr-section-line--head");
      b.add(line.from, line.from, Decoration.line({ class: classes.join(" ") }));
    }
  }
  return b.finish();
}

/** Карточки секций по ATX-заголовкам `#`–`###` (как rehypeKadrSections в превью). */
export function markdownHeadingSectionBlocks(
  getEnabled: () => boolean,
  maxHeadingLevel = 3,
) {
  return StateField.define<DecorationSet>({
    create(state) {
      if (!getEnabled()) return Decoration.none;
      return buildHeadingSectionDecorations(state.doc, maxHeadingLevel);
    },
    update(value, tr) {
      if (!getEnabled()) return Decoration.none;
      if (!tr.docChanged) {
        if (value === Decoration.none) {
          return buildHeadingSectionDecorations(tr.state.doc, maxHeadingLevel);
        }
        return value;
      }
      return buildHeadingSectionDecorations(tr.state.doc, maxHeadingLevel);
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}
