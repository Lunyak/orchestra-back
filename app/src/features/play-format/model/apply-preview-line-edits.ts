/** Подставляет ручные правки строк в превью (номера с 1). */
export function applyPreviewLineEdits(
  text: string,
  edits: Readonly<Record<number, string>>,
): string {
  if (!text || !Object.keys(edits).length) return text;
  const lines = text.split("\n");
  for (const [lineNoRaw, content] of Object.entries(edits)) {
    const index = Number(lineNoRaw) - 1;
    if (index < 0 || index >= lines.length) continue;
    lines[index] = content;
  }
  return lines.join("\n");
}
