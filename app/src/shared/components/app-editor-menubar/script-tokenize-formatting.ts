export type TokenizeMatchesResult = {
  value: string;
  count: number;
  selection?: {
    from: number;
    to: number;
  };
};

export type ScriptTokenizeMode = "all" | "next";

type ScriptTokenizeRequestDetail = {
  query: string;
  mode: ScriptTokenizeMode;
  result: TokenizeMatchesResult | null;
};

type TokenSpan = {
  start: number;
  end: number;
};

function getTokenSpans(value: string): TokenSpan[] {
  const spans: TokenSpan[] = [];
  const tokenRe = /\[\[[\s\S]*?\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(value)) !== null) {
    spans.push({ start: match.index, end: match.index + match[0].length });
  }

  return spans;
}

function overlapsToken(from: number, to: number, spans: TokenSpan[]) {
  return spans.some((span) => from < span.end && to > span.start);
}

function findNextUntokenizedMatch(
  value: string,
  needle: string,
  startAt: number,
): { from: number; to: number } | null {
  const spans = getTokenSpans(value);
  const normalizedStart = Math.max(0, Math.min(value.length, Math.trunc(startAt)));

  const findFrom = (from: number, before: number) => {
    let index = value.indexOf(needle, from);
    while (index !== -1 && index < before) {
      const to = index + needle.length;
      if (to <= before && !overlapsToken(index, to, spans)) {
        return { from: index, to };
      }
      index = value.indexOf(needle, to);
    }
    return null;
  };

  return findFrom(normalizedStart, value.length) ?? findFrom(0, normalizedStart);
}

/** Диапазоны совпадений поисковика форматирования (без уже обёрнутых `[[…]]`). */
export function findMarkdownSearchMatches(
  value: string,
  query: string,
): Array<{ from: number; to: number }> {
  const needle = query.trim();
  if (!needle) return [];

  const spans = getTokenSpans(value);
  const ranges: Array<{ from: number; to: number }> = [];
  let from = value.indexOf(needle);

  while (from !== -1) {
    const to = from + needle.length;
    if (!overlapsToken(from, to, spans)) {
      ranges.push({ from, to });
    }
    from = value.indexOf(needle, to);
  }

  return ranges;
}

export function wrapMarkdownMatchesAsTokens(
  value: string,
  query: string,
): TokenizeMatchesResult {
  const ranges = findMarkdownSearchMatches(value, query);
  if (!ranges.length) return { value, count: 0 };

  let cursor = 0;
  let nextValue = "";
  ranges.forEach((range) => {
    nextValue += value.slice(cursor, range.from);
    nextValue += `[[${value.slice(range.from, range.to)}]]`;
    cursor = range.to;
  });
  nextValue += value.slice(cursor);

  return { value: nextValue, count: ranges.length };
}

export function wrapNextMarkdownMatchAsToken(
  value: string,
  query: string,
  startAt: number,
): TokenizeMatchesResult {
  const needle = query.trim();
  if (!needle) return { value, count: 0 };

  const range = findNextUntokenizedMatch(value, needle, startAt);
  if (!range) return { value, count: 0 };

  const nextValue = `${value.slice(0, range.from)}[[${value.slice(range.from, range.to)}]]${value.slice(range.to)}`;
  const tokenEnd = range.to + 4;
  const nextRange = findNextUntokenizedMatch(nextValue, needle, tokenEnd);

  return {
    value: nextValue,
    count: 1,
    selection: nextRange
      ? { from: nextRange.from, to: nextRange.to }
      : { from: tokenEnd, to: tokenEnd },
  };
}

const SCRIPT_TOKENIZE_REQUEST_EVENT = "orchestra:script-tokenize-request";

export function requestScriptTokenizeMatches(
  query: string,
  mode: ScriptTokenizeMode,
): TokenizeMatchesResult | null {
  if (typeof window === "undefined") return null;

  const detail: ScriptTokenizeRequestDetail = { query, mode, result: null };
  window.dispatchEvent(new CustomEvent(SCRIPT_TOKENIZE_REQUEST_EVENT, { detail }));
  return detail.result;
}

export function subscribeScriptTokenizeRequests(
  handler: (detail: Pick<ScriptTokenizeRequestDetail, "query" | "mode">) => TokenizeMatchesResult,
) {
  if (typeof window === "undefined") return () => undefined;

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ScriptTokenizeRequestDetail>).detail;
    if (!detail) return;
    detail.result = handler(detail);
  };

  window.addEventListener(SCRIPT_TOKENIZE_REQUEST_EVENT, listener);
  return () => window.removeEventListener(SCRIPT_TOKENIZE_REQUEST_EVENT, listener);
}

const SCRIPT_FORMAT_SEARCH_EVENT = "orchestra:script-format-search";

type ScriptFormatSearchDetail = {
  query: string;
};

let lastFormatSearchQuery = "";

export function getScriptFormatSearchQuery() {
  return lastFormatSearchQuery;
}

/** Подсветка совпадений в тексте при вводе в поисковик форматирования. */
export function requestScriptFormatSearchHighlight(query: string) {
  lastFormatSearchQuery = String(query ?? "");
  if (typeof window === "undefined") return;
  const detail: ScriptFormatSearchDetail = { query: lastFormatSearchQuery };
  window.dispatchEvent(new CustomEvent(SCRIPT_FORMAT_SEARCH_EVENT, { detail }));
}

export function subscribeScriptFormatSearchHighlight(
  handler: (query: string) => void,
) {
  if (typeof window === "undefined") return () => undefined;

  handler(lastFormatSearchQuery);

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ScriptFormatSearchDetail>).detail;
    handler(String(detail?.query ?? ""));
  };

  window.addEventListener(SCRIPT_FORMAT_SEARCH_EVENT, listener);
  return () => window.removeEventListener(SCRIPT_FORMAT_SEARCH_EVENT, listener);
}

export type CollapseBlankLinesResult = {
  value: string;
  removed: number;
  changed: boolean;
};

/**
 * Убирает пустые строки и хвостовые пробелы, оставляя одиночные переносы между непустыми строками.
 */
export function collapseExtraBlankLines(value: string): CollapseBlankLinesResult {
  const normalized = String(value ?? "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const kept: string[] = [];
  let removed = 0;

  for (const line of lines) {
    const cleaned = line.replace(/[ \t]+$/g, "");
    if (cleaned.trim().length === 0) {
      removed += 1;
      continue;
    }
    kept.push(cleaned);
  }

  const nextValue = kept.join("\n");
  const changed = nextValue !== normalized;

  return {
    value: nextValue,
    removed: changed ? removed : 0,
    changed,
  };
}

const SCRIPT_COLLAPSE_BLANK_LINES_EVENT = "orchestra:script-collapse-blank-lines";

type ScriptCollapseBlankLinesDetail = {
  result: CollapseBlankLinesResult | null;
};

export function requestScriptCollapseBlankLines(): CollapseBlankLinesResult | null {
  if (typeof window === "undefined") return null;

  const detail: ScriptCollapseBlankLinesDetail = { result: null };
  window.dispatchEvent(
    new CustomEvent(SCRIPT_COLLAPSE_BLANK_LINES_EVENT, { detail }),
  );
  return detail.result;
}

export function subscribeScriptCollapseBlankLines(
  handler: () => CollapseBlankLinesResult,
) {
  if (typeof window === "undefined") return () => undefined;

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ScriptCollapseBlankLinesDetail>).detail;
    if (!detail) return;
    detail.result = handler();
  };

  window.addEventListener(SCRIPT_COLLAPSE_BLANK_LINES_EVENT, listener);
  return () => window.removeEventListener(SCRIPT_COLLAPSE_BLANK_LINES_EVENT, listener);
}
