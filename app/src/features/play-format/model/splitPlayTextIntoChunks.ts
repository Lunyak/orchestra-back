/** Строка-граница шага: «Акт 1», «Сцена II», «Картина 3», «### Картина 2» и т.п. */
const STRUCTURAL_SPLIT_RE =
  /^(?:#{1,3}\s+)?(?:\*\*)?(?:ДЕЙСТВИЕ|АКТ|СЦЕНА|КАРТИН[АУЕЙ]|МИЗАНСЦЕНА)(?:\s|[:.)\]]|$)/iu;

export function isPlayStructuralSplitLine(line: string): boolean {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) return false;
  return STRUCTURAL_SPLIT_RE.test(trimmed);
}

export function splitPlayTextIntoChunks(text: string): string[] {
  const normalized = String(text ?? "").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (isPlayStructuralSplitLine(line) && current.length > 0) {
      const chunk = current.join("\n").trim();
      if (chunk) chunks.push(chunk);
      current = [line];
    } else {
      current.push(line);
    }
  }

  const last = current.join("\n").trim();
  if (last) chunks.push(last);

  return chunks.length > 0 ? chunks : [normalized];
}

export function deriveStepTitleFromChunk(chunk: string, fallback: string): string {
  const firstLine =
    chunk
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? "";

  if (isPlayStructuralSplitLine(firstLine)) {
    return firstLine
      .replace(/^#{1,3}\s+/, "")
      .replace(/\*\*/g, "")
      .trim()
      .slice(0, 60);
  }

  const heading = chunk.match(/^#{1,3}\s+(.+)$/m);
  if (heading?.[1]) {
    return heading[1].trim().replace(/\s+/g, " ").slice(0, 60);
  }

  const role = chunk.match(/^\[\[\s*([^\]]+?)\s*\]\]/m);
  if (role?.[1]) {
    return role[1].trim().replace(/\s+/g, " ").slice(0, 60);
  }

  if (firstLine) {
    return firstLine.replace(/^\[\[[^\]]+\]\]\s*/, "").slice(0, 40);
  }

  return fallback;
}
