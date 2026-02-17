export interface PreviewOptions {
  maxLen?: number;
}

/**
 * Делает читабельный превью-текст из markdown/скрипта:
 * - убирает [[Роль]] -> Роль
 * - убирает картинки/ссылки markdown
 * - убирает лишние символы форматирования
 */
export function markdownToPlainText(src: string, options: PreviewOptions = {}): string {
  const maxLen = typeof options.maxLen === "number" ? options.maxLen : 0;
  let s = String(src ?? "");

  // Normalize newlines
  s = s.replace(/\r\n/g, "\n");

  // [[Role]] -> Role
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_m, p1) => String(p1 ?? "").trim());

  // Images: ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_m, alt) => String(alt ?? "").trim());

  // Links: [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, (_m, txt) => String(txt ?? "").trim());

  // Inline code/backticks
  s = s.replace(/`{1,3}([^`]+)`{1,3}/g, (_m, inner) => String(inner ?? "").trim());

  // Headings/quotes/list markers at line starts
  s = s.replace(/^\s{0,3}(#{1,6}\s+|>\s+|-{1,2}\s+|\*\s+|\d+\.\s+)/gm, "");

  // Emphasis markers (keep text)
  s = s.replace(/(\*\*|__|\*|_)/g, "");

  // Collapse whitespace
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.trim();

  if (maxLen > 0 && s.length > maxLen) {
    s = s.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
  }
  return s;
}

