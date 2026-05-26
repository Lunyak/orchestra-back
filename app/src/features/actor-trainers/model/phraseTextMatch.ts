import { tokenizeWords } from "./wordTokens";

export const PHRASE_PASS_RATIO_OPTIONS = [70, 75, 80, 85, 90, 95] as const;
export type PhrasePassRatioPercent = (typeof PHRASE_PASS_RATIO_OPTIONS)[number];
export const DEFAULT_PHRASE_PASS_RATIO_PERCENT: PhrasePassRatioPercent = 80;

export function stripParentheses(text: string): string {
  let s = String(text ?? "");
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function normalizeForCheck(text: string): string {
  return stripParentheses(text)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set<string>([
  "и",
  "а",
  "но",
  "или",
  "да",
  "в",
  "во",
  "на",
  "по",
  "под",
  "над",
  "за",
  "от",
  "до",
  "из",
  "у",
  "к",
  "ко",
  "с",
  "со",
  "о",
  "об",
  "обо",
  "для",
  "при",
  "без",
  "не",
  "ни",
  "же",
  "ли",
  "бы",
]);

function asHashNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const v = Math.max(0, Math.min(999_999_999, Math.trunc(n)));
  return `#${v}`;
}

const RU_THOUSAND_WORDS = new Set<string>([
  "тысяча",
  "тысячи",
  "тысяч",
  "тысяче",
  "тысячу",
  "тысячей",
  "тысячами",
]);

const RU_MILLION_WORDS = new Set<string>([
  "миллион",
  "миллиона",
  "миллионов",
  "миллионе",
  "миллионом",
  "миллионами",
]);

const RU_BILLION_WORDS = new Set<string>([
  "миллиард",
  "миллиарда",
  "миллиардов",
  "миллиарде",
  "миллиардом",
  "миллиардами",
]);

function ruScaleMultiplier(word: string): number | null {
  const w = String(word ?? "").toLowerCase();
  if (!w) return null;
  if (RU_THOUSAND_WORDS.has(w)) return 1_000;
  if (RU_MILLION_WORDS.has(w)) return 1_000_000;
  if (RU_BILLION_WORDS.has(w)) return 1_000_000_000;
  return null;
}

function ruNumberWordValue(word: string): number | null {
  const w = String(word ?? "").toLowerCase();
  if (!w) return null;
  if (/^\d+$/.test(w)) return Number(w);

  const units: Record<string, number> = {
    ноль: 0,
    нуля: 0,
    один: 1,
    одна: 1,
    одно: 1,
    одного: 1,
    одному: 1,
    одином: 1,
    одну: 1,
    одной: 1,
    два: 2,
    две: 2,
    двух: 2,
    двум: 2,
    тремя: 3,
    три: 3,
    трех: 3,
    трёх: 3,
    четырем: 4,
    четыре: 4,
    четырех: 4,
    четырёх: 4,
    пять: 5,
    пяти: 5,
    шесть: 6,
    шести: 6,
    семь: 7,
    семи: 7,
    восемь: 8,
    восьми: 8,
    девять: 9,
    девяти: 9,
  };
  if (w in units) return units[w]!;

  const teens: Record<string, number> = {
    десять: 10,
    десяти: 10,
    одиннадцать: 11,
    одиннадцати: 11,
    двенадцать: 12,
    двенадцати: 12,
    тринадцать: 13,
    тринадцати: 13,
    четырнадцать: 14,
    четырнадцати: 14,
    пятнадцать: 15,
    пятнадцати: 15,
    шестнадцать: 16,
    шестнадцати: 16,
    семнадцать: 17,
    семнадцати: 17,
    восемнадцать: 18,
    восемнадцати: 18,
    девятнадцать: 19,
    девятнадцати: 19,
  };
  if (w in teens) return teens[w]!;

  const tens: Array<{ re: RegExp; v: number }> = [
    { re: /^двадцат(ь|и|ью)?$/u, v: 20 },
    { re: /^тридцат(ь|и|ью)?$/u, v: 30 },
    { re: /^сорок(а|у|ом)?$/u, v: 40 },
    { re: /^пятьдесят(и|ью)?$/u, v: 50 },
    { re: /^шестьдесят(и|ью)?$/u, v: 60 },
    { re: /^семьдесят(и|ью)?$/u, v: 70 },
    { re: /^(восемьдесят|восьмидесят|восьмидесяти|восьмьюдесятью)$/u, v: 80 },
    { re: /^девяност(о|а|у|ом)?$/u, v: 90 },
  ];
  for (const t of tens) if (t.re.test(w)) return t.v;

  if (w === "сто" || w === "ста" || w === "сот") return 100;
  return null;
}

function consumeRuBaseNumber(tokens: string[], i: number): { value: number; nextIndex: number } | null {
  const a = tokens[i];
  if (!a) return null;

  if (/^\d+$/.test(a)) {
    if (/^\d{1,3}$/.test(a)) {
      let s = a;
      let j = i + 1;
      while (j < tokens.length && /^\d{3}$/.test(tokens[j] ?? "")) {
        s += tokens[j];
        j += 1;
      }
      return { value: Number(s), nextIndex: j };
    }
    return { value: Number(a), nextIndex: i + 1 };
  }

  const va = ruNumberWordValue(a);
  if (va == null) return null;

  if (va >= 20 && va % 10 === 0) {
    const b = tokens[i + 1];
    const vb = b ? ruNumberWordValue(b) : null;
    if (vb != null && vb >= 1 && vb <= 9) return { value: va + vb, nextIndex: i + 2 };
    return { value: va, nextIndex: i + 1 };
  }

  return { value: va, nextIndex: i + 1 };
}

function normalizeNumberSequences(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const parsed = consumeRuBaseNumber(tokens, i);
    if (!parsed) {
      const mult = ruScaleMultiplier(tokens[i] ?? "");
      if (mult) out.push(asHashNumber(mult));
      else out.push(tokens[i]!);
      continue;
    }

    let value = parsed.value;
    let j = parsed.nextIndex;
    const mult = ruScaleMultiplier(tokens[j] ?? "");
    if (mult) {
      value *= mult;
      j += 1;
      const rem = consumeRuBaseNumber(tokens, j);
      if (rem && rem.value >= 0 && rem.value < mult) {
        value += rem.value;
        j = rem.nextIndex;
      }
    }

    out.push(asHashNumber(value));
    i = j - 1;
  }
  return out;
}

function softStemRu(word: string): string {
  const w = String(word ?? "").toLowerCase();
  if (!w) return "";
  if (w.length <= 4) return w;

  const endings = [
    "иями",
    "ями",
    "ами",
    "ого",
    "ему",
    "ому",
    "ыми",
    "ими",
    "иях",
    "ях",
    "ах",
    "ам",
    "ям",
    "ала",
    "али",
    "ало",
    "ал",
    "ых",
    "их",
    "ым",
    "им",
    "ов",
    "ев",
    "ом",
    "ем",
    "ой",
    "ей",
    "ую",
    "юю",
    "ая",
    "яя",
    "ое",
    "ее",
    "ый",
    "ий",
    "ые",
    "ие",
    "а",
    "я",
    "ы",
    "и",
    "у",
    "ю",
    "е",
    "о",
  ];

  for (const end of endings) {
    if (!w.endsWith(end)) continue;
    const base = w.slice(0, Math.max(0, w.length - end.length));
    if (base.length >= 3) return base;
  }

  return w;
}

function normalizeTokenForScore(token: string): string {
  const t = String(token ?? "").trim().toLowerCase();
  if (!t) return "";
  if (t.startsWith("#")) return t;
  if (/^руб(л(я|ей|ю|ем|лях|лям|ли)?)?$/u.test(t)) return "руб";
  return softStemRu(t);
}

function tokensForScore(text: string): string[] {
  const base = tokenizeWords(normalizeForCheck(text)).map((t) => t.norm);
  const withNums = normalizeNumberSequences(base);
  const filtered = withNums.filter((w) => w && !STOP_WORDS.has(w));
  return filtered.map(normalizeTokenForScore).filter(Boolean);
}

function editDistanceLeq1(aRaw: string, bRaw: string): boolean {
  const a = String(aRaw ?? "");
  const b = String(bRaw ?? "");
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  const diff = Math.abs(la - lb);
  if (diff > 1) return false;

  if (la === lb) {
    let mism = 0;
    for (let i = 0; i < la; i += 1) {
      if (a[i] !== b[i]) mism += 1;
      if (mism > 1) return false;
    }
    return mism === 1;
  }

  const s = la < lb ? a : b;
  const t = la < lb ? b : a;
  let i = 0;
  let j = 0;
  let skipped = 0;
  while (i < s.length && j < t.length) {
    if (s[i] === t[j]) {
      i += 1;
      j += 1;
      continue;
    }
    skipped += 1;
    if (skipped > 1) return false;
    j += 1;
  }
  return true;
}

function tokensMatch(a: string, b: string): boolean {
  return a === b || editDistanceLeq1(a, b);
}

export type PhraseWordIssue = {
  kind: "wrong" | "missing" | "extra";
  expected?: string;
  typed?: string;
};

export type MatchToken = {
  display: string;
  score: string;
};

function buildMatchTokens(text: string): MatchToken[] {
  const stripped = stripParentheses(text);
  const words = tokenizeWords(stripped);
  const norms = words.map((w) => w.norm);
  const out: MatchToken[] = [];

  for (let i = 0; i < words.length; i += 1) {
    const w = words[i]!;
    if (STOP_WORDS.has(w.norm)) continue;

    const parsed = consumeRuBaseNumber(norms, i);
    if (parsed) {
      let j = parsed.nextIndex;
      let value = parsed.value;
      const mult = ruScaleMultiplier(norms[j] ?? "");
      if (mult) {
        value *= mult;
        j += 1;
        const rem = consumeRuBaseNumber(norms, j);
        if (rem && rem.value >= 0 && rem.value < mult) {
          value += rem.value;
          j = rem.nextIndex;
        }
      }
      const display = words
        .slice(i, j)
        .map((x) => x.text)
        .join(" ");
      out.push({ display, score: asHashNumber(value) });
      i = j - 1;
      continue;
    }

    const mult = ruScaleMultiplier(w.norm);
    if (mult) {
      out.push({ display: w.text, score: asHashNumber(mult) });
      continue;
    }

    const score = normalizeTokenForScore(w.norm);
    if (score) out.push({ display: w.text, score });
  }

  return out;
}

function matchStats(expected: string[], spoken: string[]): { matched: number; ratio: number } {
  if (expected.length === 0) return { matched: 0, ratio: 0 };
  if (spoken.length === 0) return { matched: 0, ratio: 0 };

  const m = spoken.length;
  const dp = new Array<number>(m + 1).fill(0);

  for (let i = 1; i <= expected.length; i += 1) {
    let prevDiag = 0;
    const e = expected[i - 1]!;
    for (let j = 1; j <= m; j += 1) {
      const tmp = dp[j]!;
      const s = spoken[j - 1]!;
      if (tokensMatch(s, e)) dp[j] = prevDiag + 1;
      else dp[j] = Math.max(dp[j]!, dp[j - 1]!);
      prevDiag = tmp;
    }
  }

  const matched = dp[m] ?? 0;
  return { matched, ratio: matched / expected.length };
}

function matchAlignment(
  expected: MatchToken[],
  typed: MatchToken[],
): {
  matchedExpectedIdx: Set<number>;
  matchedTypedIdx: Set<number>;
} {
  const n = expected.length;
  const m = typed.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const e = expected[i - 1]!.score;
      const t = typed[j - 1]!.score;
      if (tokensMatch(e, t)) dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      else dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }

  const matchedExpectedIdx = new Set<number>();
  const matchedTypedIdx = new Set<number>();
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const e = expected[i - 1]!.score;
    const t = typed[j - 1]!.score;
    if (tokensMatch(e, t) && dp[i]![j] === dp[i - 1]![j - 1]! + 1) {
      matchedExpectedIdx.add(i - 1);
      matchedTypedIdx.add(j - 1);
      i -= 1;
      j -= 1;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return { matchedExpectedIdx, matchedTypedIdx };
}

function issuesFromAlignment(expected: MatchToken[], typed: MatchToken[]): PhraseWordIssue[] {
  if (expected.length === 0 && typed.length === 0) return [];

  const { matchedExpectedIdx, matchedTypedIdx } = matchAlignment(expected, typed);
  const issues: PhraseWordIssue[] = [];

  const unmatchedTypedIdx = typed.map((_, idx) => idx).filter((idx) => !matchedTypedIdx.has(idx));
  let unmatchedTypedCursor = 0;

  for (let ei = 0; ei < expected.length; ei += 1) {
    if (matchedExpectedIdx.has(ei)) continue;
    const expectedWord = expected[ei]!.display;
    const typedIdx = unmatchedTypedIdx[unmatchedTypedCursor];
    if (typedIdx != null) {
      issues.push({
        kind: "wrong",
        expected: expectedWord,
        typed: typed[typedIdx]!.display,
      });
      unmatchedTypedCursor += 1;
      continue;
    }
    issues.push({ kind: "missing", expected: expectedWord });
  }

  while (unmatchedTypedCursor < unmatchedTypedIdx.length) {
    const typedIdx = unmatchedTypedIdx[unmatchedTypedCursor]!;
    issues.push({ kind: "extra", typed: typed[typedIdx]!.display });
    unmatchedTypedCursor += 1;
  }

  return issues;
}

export function normalizePassRatioPercent(value: unknown): PhrasePassRatioPercent {
  const n = Number(value);
  return PHRASE_PASS_RATIO_OPTIONS.includes(n as PhrasePassRatioPercent)
    ? (n as PhrasePassRatioPercent)
    : DEFAULT_PHRASE_PASS_RATIO_PERCENT;
}

export function scorePhraseText(
  expectedText: string,
  typedText: string,
  passRatioPercent: number = DEFAULT_PHRASE_PASS_RATIO_PERCENT,
): {
  ratio: number;
  ok: boolean;
  passRatioPercent: PhrasePassRatioPercent;
  issues: PhraseWordIssue[];
} {
  const pass = normalizePassRatioPercent(passRatioPercent);
  const expected = buildMatchTokens(expectedText);
  const typed = buildMatchTokens(typedText);
  const expectedScores = expected.map((t) => t.score);
  const typedScores = typed.map((t) => t.score);
  const { ratio } = matchStats(expectedScores, typedScores);
  const issues = issuesFromAlignment(expected, typed);
  return {
    ratio,
    ok: expected.length > 0 ? ratio >= pass / 100 : false,
    passRatioPercent: pass,
    issues,
  };
}
