import type { FormatPlayPreviewStats } from "../model/useFormatPlayTextModal";

type BuildFormatPlayMetaMessageArgs = {
  hasUnmatchedMarkers: boolean;
  unmatchedMarkers: string[];
  displayWarningsCount: number;
  warningsSummary: string;
  stats: FormatPlayPreviewStats;
  lineEditCount: number;
  useRoleMarkers: boolean;
  enabledRoleCount: number;
  splitBlocked: boolean;
  splitIntoScenes: boolean;
  sceneChunksCount: number;
  previewUnchanged: boolean;
};

export function buildFormatPlayMetaMessage({
  hasUnmatchedMarkers,
  unmatchedMarkers,
  displayWarningsCount,
  warningsSummary,
  stats,
  lineEditCount,
  useRoleMarkers,
  enabledRoleCount,
  splitBlocked,
  splitIntoScenes,
  sceneChunksCount,
  previewUnchanged,
}: BuildFormatPlayMetaMessageArgs): string {
  if (hasUnmatchedMarkers) {
    return `Не найдено в тексте: ${unmatchedMarkers.map((marker) => `«${marker}»`).join(", ")}.`;
  }

  if (displayWarningsCount > 0) {
    return `Проверь строки: ${warningsSummary}. Кликни предупреждение над превью «Станет».`;
  }

  const hasStats =
    stats.inlineSplits > 0 ||
    stats.mergedLines > 0 ||
    stats.labeledLines > 0 ||
    stats.propagatedLines > 0 ||
    stats.matchedMarkers > 0 ||
    stats.ocrLinesFixed > 0 ||
    stats.castLinesFormatted > 0 ||
    stats.trimmedLines > 0 ||
    stats.labelDotsStripped > 0 ||
    lineEditCount > 0;

  if (hasStats) {
    const parts: string[] = [];
    if (lineEditCount > 0) parts.push(`Строк исправлено вручную: ${lineEditCount}.`);
    if (stats.ocrLinesFixed > 0) parts.push(`OCR-строк исправлено: ${stats.ocrLinesFixed}.`);
    if (stats.noiseLinesRemoved > 0) {
      parts.push(`Служебных строк убрано: ${stats.noiseLinesRemoved}.`);
    }
    if (stats.castLinesFormatted > 0) {
      parts.push(`Персонажей в списке: ${stats.castRolesFound}.`);
    }
    if (stats.castSplitLines > 0) {
      parts.push(`Строк списка разбито: ${stats.castSplitLines}.`);
    }
    if (stats.inlineSplits > 0) parts.push(`Реплик разобрано: ${stats.inlineSplits}.`);
    if (stats.matchedMarkers > 0) parts.push(`Меток на строках: ${stats.matchedMarkers}.`);
    if (stats.mergedLines > 0) parts.push(`Склеено строк: ${stats.mergedLines}.`);
    if (stats.labeledLines > 0) parts.push(`Лейблов в строке: ${stats.labeledLines}.`);
    if (stats.trimmedLines > 0) parts.push(`Строк без лишних пробелов: ${stats.trimmedLines}.`);
    if (stats.labelDotsStripped > 0) {
      parts.push(`Точек после лейблов убрано: ${stats.labelDotsStripped}.`);
    }
    if (stats.propagatedLines > 0) parts.push(`Реплик по меткам: ${stats.propagatedLines}.`);
    return parts.join(" ");
  }

  if (useRoleMarkers && enabledRoleCount > 0) {
    return `Выбрано ролей: ${enabledRoleCount}. Смотри колонку «Станет».`;
  }
  if (splitBlocked) {
    return "Для нарезки нужны заголовки «Акт», «Сцена» или «Картина» в тексте.";
  }
  if (splitIntoScenes && sceneChunksCount > 1) {
    return `Будет создано сцен: ${sceneChunksCount}.`;
  }
  if (previewUnchanged) return "Изменений нет.";
  return "Можно применить.";
}
