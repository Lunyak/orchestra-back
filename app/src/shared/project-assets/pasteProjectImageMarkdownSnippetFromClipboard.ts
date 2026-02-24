import type {
  PasteProjectImageFromClipboardOptions,
  PasteProjectImageFromClipboardResult,
} from "./pasteProjectImageFromClipboard";
import { pasteProjectImageFromClipboard } from "./pasteProjectImageFromClipboard";

export async function pasteProjectImageMarkdownSnippetFromClipboard(
  event: { clipboardData?: DataTransfer | null; preventDefault: () => void },
  options: PasteProjectImageFromClipboardOptions & { alt?: string },
): Promise<{ snippet: string; result: PasteProjectImageFromClipboardResult } | null> {
  const result = await pasteProjectImageFromClipboard(event, options);
  if (!result) return null;
  const alt = (options.alt ?? "image").trim() || "image";
  const snippet = `\n\n![${alt}](${result.markdownPath})\n\n`;
  return { snippet, result };
}

