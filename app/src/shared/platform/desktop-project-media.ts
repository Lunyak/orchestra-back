import { getDesktopApi } from "./desktop-api";

/** Сохранить медиафайл проектора в локальную папку проекта (videos/ или images/). */
export async function saveDesktopProjectMediaFromFile(
  projectSlug: string,
  kind: "video" | "image",
  file: File,
): Promise<{ file: string; filePath: string } | null> {
  const api = getDesktopApi();
  if (!api?.invoke || !projectSlug) return null;
  const channel = kind === "video" ? "add-project-video" : "add-project-image";
  try {
    const data = await file.arrayBuffer();
    const res = (await api.invoke(channel, {
      projectName: projectSlug,
      data,
      mimeType: file.type || undefined,
      originalName: file.name,
    })) as { ok?: boolean; file?: string; absolutePath?: string };
    if (!res?.ok || !String(res.absolutePath ?? "").trim()) return null;
    return {
      file: String(res.file ?? file.name),
      filePath: String(res.absolutePath),
    };
  } catch (err) {
    console.error(`[desktop] save ${kind} failed:`, err);
    return null;
  }
}
