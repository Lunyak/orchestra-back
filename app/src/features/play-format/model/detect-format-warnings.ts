import { shouldCollapseSpacedLetters } from "./play-text-ocr";

export type FormatWarning = {
  line: number;
  message: string;
};

function countRoleTags(line: string): number {
  return (line.match(/\[\[/g) ?? []).length;
}

function looksLikeDenseCastLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (countRoleTags(trimmed) > 2) return true;
  if (/\.\s+\d+-я\b/i.test(trimmed)) return true;
  if (/\s+Очень\s+ответственн/i.test(trimmed) && trimmed.length > 48) return true;
  return false;
}

/** Подозрительные строки в результате форматирования. */
export function detectFormatWarnings(text: string): FormatWarning[] {
  const warnings: FormatWarning[] = [];
  const lines = String(text ?? "").split("\n");
  let inCast = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    const lineNo = index + 1;

    if (/^ДЕЙСТВУЮЩ(?:ИЕ|ИХ)\s+(?:ЛИЦА|ПЕРСОНАЖИ)/i.test(trimmed)) {
      inCast = true;
      continue;
    }
    if (/^(?:АКТ|СЦЕНА|КАРТИН[АУЕЙ]|ДЕЙСТВИЕ)(?:\s|$|[.:])/i.test(trimmed)) {
      inCast = false;
    }

    if (shouldCollapseSpacedLetters(trimmed)) {
      warnings.push({ line: lineNo, message: "остались OCR-пробелы в буквах" });
    }

    if (countRoleTags(trimmed) > 2) {
      warnings.push({ line: lineNo, message: "несколько меток ролей в одной строке" });
    }

    if (inCast && looksLikeDenseCastLine(trimmed) && countRoleTags(trimmed) <= 2) {
      warnings.push({ line: lineNo, message: "плотная строка списка персонажей — проверь разбиение" });
    }

    if (/\[\[[^\]]{40,}\]\]/.test(trimmed)) {
      warnings.push({ line: lineNo, message: "очень длинное имя в метке" });
    }
  }

  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.line}:${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatWarningsSummary(warnings: FormatWarning[]): string {
  if (!warnings.length) return "";
  const preview = warnings
    .slice(0, 3)
    .map((warning) => `стр. ${warning.line}: ${warning.message}`)
    .join("; ");
  const suffix = warnings.length > 3 ? ` и ещё ${warnings.length - 3}` : "";
  return `${preview}${suffix}`;
}
