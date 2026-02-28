import type {
  PasteProjectImageFromClipboardOptions,
  PasteProjectImageFromClipboardResult,
} from "./pasteProjectImageFromClipboard";
import { pasteProjectImageFromClipboard } from "./pasteProjectImageFromClipboard";
import { ensureProject, uploadProjectFile } from "../../sync/api";

export async function pasteProjectImageMarkdownSnippetFromClipboard(
  event: { clipboardData?: DataTransfer | null; preventDefault: () => void },
  options: PasteProjectImageFromClipboardOptions & { alt?: string },
): Promise<{ snippet: string; result: PasteProjectImageFromClipboardResult } | null> {
  // Desktop-first (saves file into project folder)
  const desktopResult = await pasteProjectImageFromClipboard(event, options);
  if (desktopResult) {
    const alt = (options.alt ?? "image").trim() || "image";
    const snippet = `\n\n![${alt}](${desktopResult.markdownPath})\n\n`;
    return { snippet, result: desktopResult };
  }

  // Web fallback: upload clipboard image directly to MinIO and insert remoteKey token
  const clipboardData = event.clipboardData;
  if (!clipboardData) return null;
  const items = Array.from(clipboardData.items || []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) return null;
  const file = imageItem.getAsFile();
  if (!file) return null;

  const accessToken =
    options.accessToken ??
    (typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null);
  if (!accessToken) return null;

  event.preventDefault();

  const project = await ensureProject(
    accessToken,
    options.projectSlug,
    options.projectTitle ?? `Проект ${options.projectSlug}`,
  );
  const { key, url } = await uploadProjectFile(accessToken, {
    projectId: project.id,
    type: "image",
    file,
  });

  const alt = (
    options.alt ?? (file.name.replace(/\.[^.]+$/, "") || "image")
  ).trim() || "image";
  const token = `orchestra-image:${encodeURIComponent(key)}`;
  const snippet = `\n\n![${alt}](${token})\n\n`;

  return {
    snippet,
    result: {
      markdownPath: token,
      filename: file.name,
      mime: file.type,
      originalName: file.name,
      remoteKey: key,
      remoteUrl: url,
    },
  };
}

