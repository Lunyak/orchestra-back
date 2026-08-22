export type MarkdownStyleAction =
  | "bold"
  | "italic"
  | "code"
  | "heading2"
  | "heading3"
  | "quote"
  | "bullet";

export type MarkdownStyleResult = {
  value: string;
  selection: { from: number; to: number };
};

function clampRange(value: string, from: number, to: number) {
  const len = value.length;
  let start = Math.max(0, Math.min(len, Math.trunc(from)));
  let end = Math.max(0, Math.min(len, Math.trunc(to)));
  if (end < start) [start, end] = [end, start];
  return { start, end };
}

function wrapInline(
  value: string,
  from: number,
  to: number,
  marker: string,
): MarkdownStyleResult {
  const { start, end } = clampRange(value, from, to);
  const selected = value.slice(start, end);
  const open = marker;
  const close = marker;

  if (!selected) {
    const insert = `${open}${close}`;
    const nextValue = `${value.slice(0, start)}${insert}${value.slice(end)}`;
    const cursor = start + open.length;
    return { value: nextValue, selection: { from: cursor, to: cursor } };
  }

  const already =
    selected.length >= open.length + close.length &&
    selected.startsWith(open) &&
    selected.endsWith(close);

  if (already) {
    const inner = selected.slice(open.length, selected.length - close.length);
    const nextValue = `${value.slice(0, start)}${inner}${value.slice(end)}`;
    return {
      value: nextValue,
      selection: { from: start, to: start + inner.length },
    };
  }

  const wrapped = `${open}${selected}${close}`;
  const nextValue = `${value.slice(0, start)}${wrapped}${value.slice(end)}`;
  return {
    value: nextValue,
    selection: {
      from: start + open.length,
      to: start + open.length + selected.length,
    },
  };
}

function prefixLines(
  value: string,
  from: number,
  to: number,
  prefix: string,
): MarkdownStyleResult {
  const { start, end } = clampRange(value, from, to);
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const lineEndExclusive =
    end > start
      ? (() => {
          const nextBreak = value.indexOf("\n", end - (value[end - 1] === "\n" ? 1 : 0));
          return nextBreak === -1 ? value.length : nextBreak;
        })()
      : (() => {
          const nextBreak = value.indexOf("\n", lineStart);
          return nextBreak === -1 ? value.length : nextBreak;
        })();

  const block = value.slice(lineStart, lineEndExclusive);
  const lines = block.split("\n");
  const nextLines = lines.map((line) => {
    if (line.startsWith(prefix)) return line;
    return `${prefix}${line}`;
  });
  const nextBlock = nextLines.join("\n");
  const nextValue =
    value.slice(0, lineStart) + nextBlock + value.slice(lineEndExclusive);

  return {
    value: nextValue,
    selection: {
      from: lineStart,
      to: lineStart + nextBlock.length,
    },
  };
}

export function applyMarkdownStyle(
  value: string,
  from: number,
  to: number,
  action: MarkdownStyleAction,
): MarkdownStyleResult {
  switch (action) {
    case "bold":
      return wrapInline(value, from, to, "**");
    case "italic":
      return wrapInline(value, from, to, "*");
    case "code":
      return wrapInline(value, from, to, "`");
    case "heading2":
      return prefixLines(value, from, to, "## ");
    case "heading3":
      return prefixLines(value, from, to, "### ");
    case "quote":
      return prefixLines(value, from, to, "> ");
    case "bullet":
      return prefixLines(value, from, to, "- ");
    default: {
      const { start, end } = clampRange(value, from, to);
      return {
        value,
        selection: { from: start, to: end },
      };
    }
  }
}

const SCRIPT_MARKDOWN_STYLE_EVENT = "orchestra:script-markdown-style";

type ScriptMarkdownStyleDetail = {
  action: MarkdownStyleAction;
  result: MarkdownStyleResult | null;
};

export function requestScriptMarkdownStyle(
  action: MarkdownStyleAction,
): MarkdownStyleResult | null {
  if (typeof window === "undefined") return null;

  const detail: ScriptMarkdownStyleDetail = { action, result: null };
  window.dispatchEvent(new CustomEvent(SCRIPT_MARKDOWN_STYLE_EVENT, { detail }));
  return detail.result;
}

export function subscribeScriptMarkdownStyle(
  handler: (action: MarkdownStyleAction) => MarkdownStyleResult,
) {
  if (typeof window === "undefined") return () => undefined;

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ScriptMarkdownStyleDetail>).detail;
    if (!detail) return;
    detail.result = handler(detail.action);
  };

  window.addEventListener(SCRIPT_MARKDOWN_STYLE_EVENT, listener);
  return () => window.removeEventListener(SCRIPT_MARKDOWN_STYLE_EVENT, listener);
}
