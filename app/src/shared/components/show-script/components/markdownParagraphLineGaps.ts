import { RangeSetBuilder, StateField, type Text } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

/**
 * Дублирует логику из ScriptMarkdownPreview (expandScriptLineParagraphBreaks*):
 * commonmark склеивает строки без `\n\n` в один &lt;p&gt; — превью подставляет пустые строки;
 * здесь тот же ритм: сценический+сценический, обычный текст+сценический, сценический+не-сценический.
 */
function isMarkdownListItemLine(line: string): boolean {
  return /^\s{0,3}[-*+]\s+/.test(line);
}

function isScriptishBlockLine(line: string): boolean {
  const t = line.replace(/^\s{0,3}>\s?/, "").replace(/^\s{0,3}[-*+]\s+/, "").trim();
  if (!t) return false;
  if (/^\[\[/.test(t)) return true;
  if (/^\{\{\s*(?:light|blackout|b|play|sound|sfx)\b/i.test(t)) return true;
  if (/^\[[^\]]*]\(\s*(?:track|playlist)\s*:/i.test(t)) return true;
  if (/^!\[/.test(t)) return true;
  return false;
}

function needsParagraphGapAfterPrev(prevText: string, lineText: string): boolean {
  if (prevText.trim() === "" && lineText.trim() !== "") return true;

  const prevList = isMarkdownListItemLine(prevText);
  const lineList = isMarkdownListItemLine(lineText);
  const prevScr = isScriptishBlockLine(prevText) && !prevList;
  const lineScr = isScriptishBlockLine(lineText) && !lineList;

  if (prevScr && lineScr) return true;

  if (prevText.trim() !== "" && !prevScr && !prevList && lineScr) return true;

  if (prevScr && !prevList && !lineList && !lineScr && lineText.trim() !== "") return true;

  return false;
}

/** Номера строк тела fenced-блока (строки ``` не входят). */
function fencedBodyLineNumbers(doc: Text): Set<number> {
  const inside = new Set<number>();
  let inFence = false;
  for (let n = 1; n <= doc.lines; n++) {
    const text = doc.line(n).text;
    if (/^\s{0,3}```/.test(text)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) inside.add(n);
  }
  return inside;
}

const lineParaGap = Decoration.line({ class: "cm-line-para-gap" });

function buildParaGapDecorations(doc: Text): DecorationSet {
  const inFenceBody = fencedBodyLineNumbers(doc);
  const b = new RangeSetBuilder<Decoration>();
  for (let num = 2; num <= doc.lines; num++) {
    if (inFenceBody.has(num - 1) || inFenceBody.has(num)) continue;
    const prev = doc.line(num - 1);
    const line = doc.line(num);
    if (!needsParagraphGapAfterPrev(prev.text, line.text)) continue;
    /* Decoration.line привязывается к строке по *позиции начала*; диапазон [from,to) с to > from
       ломает doc view вместе с EditorView.blockWrappers (crash: parents.pop / tile). */
    b.add(line.from, line.from, lineParaGap);
  }
  return b.finish();
}

/** StateField надёжнее ViewPlugin: декорации всегда соответствуют doc после любой транзакции с docChanged. */
export const markdownParagraphLineGaps = StateField.define<DecorationSet>({
  create(state) {
    return buildParaGapDecorations(state.doc);
  },
  update(prev, tr) {
    if (!tr.docChanged) return prev;
    return buildParaGapDecorations(tr.state.doc);
  },
  provide: (f) => EditorView.decorations.from(f),
});
