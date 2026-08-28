import { stripLeadingPunctuationTokens, type WordToken } from "./wordTokens";

const AUTO_WORDS = new Set<string>([
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

export function isAutoToken(t: WordToken): boolean {
  if (t.kind === "punct") return true;
  if (t.kind === "word" && AUTO_WORDS.has(t.norm)) return true;
  return false;
}

export function answerTokensForDisplay(answer: WordToken[]): WordToken[] {
  return stripLeadingPunctuationTokens(answer);
}

export function joinAnswerTokens(tokens: WordToken[]): string {
  let out = "";
  for (const token of tokens) {
    if (!out) {
      out = token.text;
      continue;
    }
    if (token.kind === "punct") {
      out += token.text;
      continue;
    }
    out += ` ${token.text}`;
  }
  return out;
}

export type PoolWordLabel = {
  leading: WordToken[];
  trailing: WordToken[];
};

export function buildPoolWordLabels(target: WordToken[]): Map<string, PoolWordLabel> {
  const labels = new Map<string, PoolWordLabel>();
  let index = 0;
  const initialLeading: WordToken[] = [];

  while (index < target.length && isAutoToken(target[index]!)) {
    initialLeading.push(target[index]!);
    index += 1;
  }

  let isFirstContentWord = true;
  while (index < target.length) {
    const head = target[index]!;
    if (isAutoToken(head)) {
      index += 1;
      continue;
    }

    index += 1;
    const trailing: WordToken[] = [];
    while (index < target.length && isAutoToken(target[index]!)) {
      trailing.push(target[index]!);
      index += 1;
    }
    labels.set(head.id, {
      leading: isFirstContentWord ? initialLeading : [],
      trailing,
    });
    isFirstContentWord = false;
  }

  return labels;
}
