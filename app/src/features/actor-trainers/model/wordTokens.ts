export type WordToken = {
  id: string;
  text: string;
  norm: string;
  kind: "word" | "punct";
};

function normalizeToken(text: string): string {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
}

/** Ведущая пунктуация из режиссёрского текста («. Богатые…» → «Богатые…»). */
export function stripLeadingPunctuation(text: string): string {
  return String(text ?? "")
    .replace(/^[\s.,;:!?…—–\-«»"'„“”]+/u, "")
    .trim();
}

export function stripLeadingPunctuationTokens(tokens: WordToken[]): WordToken[] {
  let i = 0;
  while (i < tokens.length && tokens[i]?.kind === "punct") i += 1;
  return i > 0 ? tokens.slice(i) : tokens;
}

export function tokenizeText(
  text: string,
  opts: { includePunctuation?: boolean } = {},
): WordToken[] {
  const s = String(text ?? "");
  const includePunctuation = opts.includePunctuation === true;
  const re = includePunctuation
    ? /[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*|[.,!?;:…]+|[—–]|["'«»“”„]|[()]/gu
    : /[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu;
  const out: WordToken[] = [];
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(s))) {
    const t = String(m[0] ?? "").trim();
    if (!t) continue;
    const isWord = /[\p{L}\p{N}]/u.test(t);
    out.push({
      id: `${i}-${m.index}`,
      text: t,
      norm: isWord ? normalizeToken(t) : t,
      kind: isWord ? "word" : "punct",
    });
    i += 1;
  }
  return out;
}

export function tokenizeWords(text: string): WordToken[] {
  return tokenizeText(text, { includePunctuation: false });
}

export function shuffle<T>(items: T[], seed?: number): T[] {
  // deterministic shuffle (optional) for reproducible training
  const arr = [...items];
  let x = typeof seed === "number" && Number.isFinite(seed) ? seed : Date.now();
  const rnd = () => {
    // xorshift32
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function isSameTokenSequence(a: WordToken[], b: WordToken[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]?.norm !== b[i]?.norm) return false;
  }
  return true;
}

