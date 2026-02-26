import { getDesktopApi } from "../platform/desktop-api";
import { ensureProject } from "../../sync/api";

type ClipboardLikeEvent = {
  clipboardData?: DataTransfer | null;
  preventDefault: () => void;
};

export type PasteProjectImageFromClipboardOptions = {
  projectSlug: string;
  sceneName?: string;
  accessToken?: string | null;
  projectTitle?: string;
  persistRemoteToScene?: boolean;
};

export type PasteProjectImageFromClipboardResult = {
  markdownPath: string;
  filename: string;
  mime: string;
  originalName: string;
  remoteKey?: string;
  remoteUrl?: string;
};

function deriveFilenameFromMarkdownPath(markdownPath: string): string {
  const cleaned =
    markdownPath
      .replace(/^\.?\//, "")
      .replace(/^images\/?/, "")
      .trim() || "";
  return cleaned || markdownPath.split("/").pop() || "image.png";
}

function readLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export async function pasteProjectImageFromClipboard(
  event: ClipboardLikeEvent,
  options: PasteProjectImageFromClipboardOptions,
): Promise<PasteProjectImageFromClipboardResult | null> {
  const desktopApi = getDesktopApi();
  if (!desktopApi) return null;

  const clipboardData = event.clipboardData;
  if (!clipboardData) return null;

  const items = Array.from(clipboardData.items || []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) return null;

  const file = imageItem.getAsFile();
  if (!file) return null;

  event.preventDefault();

  const projectIdKey = `projectId:${options.projectSlug}`;
  const accessToken = options.accessToken ?? readLocalStorage("accessToken");
  let projectId = accessToken ? readLocalStorage(projectIdKey) : null;

  if (accessToken && !projectId) {
    try {
      const project = await ensureProject(
        accessToken,
        options.projectSlug,
        options.projectTitle ?? `Проект ${options.projectSlug}`,
      );
      projectId = project.id;
      writeLocalStorage(projectIdKey, projectId);
    } catch {
      // ignore: local paste should still succeed
    }
  }

  let markdownPath: string;
  let localFilePath: string | undefined;
  try {
    const buffer = await file.arrayBuffer();
    const res = await desktopApi.addProjectImage(
      options.projectSlug,
      buffer,
      file.type,
      file.name,
      projectId || undefined,
    );

    if (!res?.ok) {
      console.error("Failed to paste image:", res?.error);
      return null;
    }

    markdownPath = res.markdownPath as string;
    localFilePath = typeof res.filePath === "string" ? (res.filePath as string) : undefined;
  } catch (err) {
    console.error("Failed to paste image:", err);
    return null;
  }

  const filename = deriveFilenameFromMarkdownPath(markdownPath);

  let remoteKey: string | undefined;
  let remoteUrl: string | undefined;

  if (accessToken) {
    if (projectId) {
      try {
        const api = getDesktopApi();
        if (api?.invoke) {
          const up = (await api.invoke("upload-project-file", {
            projectName: options.projectSlug,
            file: localFilePath || filename,
            accessToken,
            projectId,
            type: "image",
          })) as { ok?: boolean; key?: string; url?: string };

          if (up?.ok && up?.url) {
            remoteKey = up.key;
            remoteUrl = up.url;

            const shouldPersist =
              (options.persistRemoteToScene ?? true) && !!options.sceneName;

            if (shouldPersist && options.sceneName) {
              const current = await desktopApi.readProjectScene(
                options.projectSlug,
                options.sceneName,
              );

              const images = {
                ...(current?.images as
                  | Record<string, { remoteKey?: string; remoteUrl?: string }>
                  | undefined),
                [filename]: { remoteKey, remoteUrl },
              };

              await desktopApi.saveProjectScene(options.projectSlug, options.sceneName, {
                ...current,
                images,
              });
            }
          }
        }
      } catch (err) {
        console.error("Markdown image upload failed:", err);
      }
    }
  }

  return {
    markdownPath,
    filename,
    mime: file.type,
    originalName: file.name,
    remoteKey,
    remoteUrl,
  };
}

