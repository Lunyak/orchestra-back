import type { SceneHoldImage, SceneVideo } from "../features/scene/model/scene-slice";
import {
  normalizeHoldImages,
  packProjectorMedia,
  unpackProjectorMedia,
} from "../features/projector/model/scene-projector-persist";
import {
  isDirectObjectStorageUrl,
  resolveProjectorStorageKey,
} from "../features/projector/model/projector-storage-key";
import { getDesktopApi } from "../shared/platform/desktop-api";
import {
  desktopReadProjectScene,
  desktopSaveProjectScene,
} from "../shared/platform/desktop-methods";
import { storageKeyToImageBasename } from "../shared/utils/markdownImages";
import { getPlayUrl } from "./api/files";

function isHttpUrl(u: string | undefined | null): boolean {
  return Boolean(u && /^https?:\/\//i.test(String(u).trim()));
}

async function resolveRemoteDownloadUrl(
  accessToken: string | null,
  remoteKey: string,
  remoteUrl: string,
): Promise<string> {
  const key = String(remoteKey ?? "").trim();
  let url = String(remoteUrl ?? "").trim();
  if (key && accessToken && (!isHttpUrl(url) || isDirectObjectStorageUrl(url))) {
    try {
      const play = await getPlayUrl(accessToken, key);
      url = String(play.url ?? "").trim();
    } catch {
      /* offline / expired token */
    }
  }
  return url;
}

function holdFileName(hold: SceneHoldImage): string {
  const key = String(hold?.remoteKey ?? resolveProjectorStorageKey(hold) ?? "").trim();
  return String(hold?.file ?? (key ? storageKeyToImageBasename(key) : ""))
    .trim()
    .replace(/^.*[/\\]/, "");
}

function videoFileName(video: SceneVideo): string {
  const key = String(video?.remoteKey ?? resolveProjectorStorageKey(video) ?? "").trim();
  return String(video?.file ?? (key ? key.replace(/\\/g, "/").split("/").filter(Boolean).pop() : ""))
    .trim()
    .replace(/^.*[/\\]/, "");
}

export type ProjectorMediaOfflineDownloadResult = {
  ok: boolean;
  changed: boolean;
  videos: SceneVideo[];
  holdImages: SceneHoldImage[];
  downloaded: number;
  localFound: number;
  alreadyLocal: number;
  failed: Array<{ kind: "video" | "image"; label: string; reason: string }>;
  message: string;
};

function buildResultMessage(result: Omit<ProjectorMediaOfflineDownloadResult, "message" | "ok">): string {
  const parts: string[] = [];
  if (result.downloaded > 0) parts.push(`скачано: ${result.downloaded}`);
  if (result.localFound > 0) parts.push(`найдено на диске: ${result.localFound}`);
  if (result.alreadyLocal > 0) parts.push(`уже локально: ${result.alreadyLocal}`);
  if (result.failed.length > 0) {
    parts.push(`не удалось: ${result.failed.length}`);
  }
  if (parts.length === 0) {
    return "Нет видео и заставок для сохранения";
  }
  if (result.failed.length === 0) {
    return `Готово — проектор работает офлайн (${parts.join(", ")})`;
  }
  const first = result.failed[0];
  return `${parts.join(", ")}. ${first.label}: ${first.reason}`;
}

/**
 * Скачивает все видео и заставки проектора в папку проекта и обновляет script.json.
 */
export async function downloadDesktopProjectorMediaOffline(args: {
  projectSlug: string;
  accessToken: string | null;
  projectId: string | null;
  onProgress?: (current: number, total: number, label: string) => void;
}): Promise<ProjectorMediaOfflineDownloadResult> {
  const empty: ProjectorMediaOfflineDownloadResult = {
    ok: false,
    changed: false,
    videos: [],
    holdImages: [],
    downloaded: 0,
    localFound: 0,
    alreadyLocal: 0,
    failed: [],
    message: "Доступно только в десктоп-приложении",
  };

  const desktop = getDesktopApi();
  if (!desktop?.invoke || !args.projectSlug) return empty;

  const invoke = desktop.invoke.bind(desktop) as (
    channel: string,
    payload: Record<string, unknown>,
  ) => Promise<any>;

  const base = (await desktopReadProjectScene(desktop, args.projectSlug, "script")) ?? {};
  const bag = unpackProjectorMedia((base as any)?.projectorMedia);
  const videos = Array.isArray((base as any)?.videos)
    ? ((base as any).videos as SceneVideo[]).map((v) => ({ ...v }))
    : bag.videos.map((v) => ({ ...v }));
  const holdImages = normalizeHoldImages(
    Array.isArray((base as any)?.holdImages) ? (base as any).holdImages : bag.holdImages,
    (base as any)?.projector,
  ).map((h) => ({ ...h }));

  const stats = {
    downloaded: 0,
    localFound: 0,
    alreadyLocal: 0,
    failed: [] as ProjectorMediaOfflineDownloadResult["failed"],
  };
  let changed = false;

  const tasks: Array<{
    kind: "video" | "image";
    index: number;
    fileName: string;
    label: string;
    key: string;
    remoteUrl: string;
    hadFilePath: boolean;
  }> = [];

  holdImages.forEach((hold, index) => {
    const fileName = holdFileName(hold);
    if (!fileName) return;
    tasks.push({
      kind: "image",
      index,
      fileName,
      label: hold.title?.trim() || `Заставка ${hold.id}`,
      key: String(hold?.remoteKey ?? resolveProjectorStorageKey(hold) ?? "").trim(),
      remoteUrl: String(hold?.remoteUrl ?? ""),
      hadFilePath: Boolean(String(hold?.filePath ?? "").trim()),
    });
  });

  videos.forEach((video, index) => {
    const fileName = videoFileName(video);
    if (!fileName) return;
    tasks.push({
      kind: "video",
      index,
      fileName,
      label: video.title?.trim() || `Видео ${video.id}`,
      key: String(video?.remoteKey ?? resolveProjectorStorageKey(video) ?? "").trim(),
      remoteUrl: String(video?.remoteUrl ?? ""),
      hadFilePath: Boolean(String(video?.filePath ?? "").trim()),
    });
  });

  const resolveLocalPath = async (kind: "image" | "video", fileName: string) => {
    const r = await invoke("resolve-project-media-path", {
      projectName: args.projectSlug,
      kind,
      fileName,
    });
    if (!r?.ok) return null;
    return String(r.absolutePath ?? "").trim() || null;
  };

  const downloadOne = async (kind: "image" | "video", fileName: string, url: string) => {
    const r = await invoke("download-remote-asset", {
      projectName: args.projectSlug,
      projectId: args.projectId,
      kind,
      fileName,
      url,
      accessToken: args.accessToken ?? undefined,
    });
    if (!r?.ok) {
      return { ok: false as const, reason: String(r?.error ?? "ошибка загрузки") };
    }
    const absolutePath = String(r.absolutePath ?? "").trim();
    if (!absolutePath) {
      return { ok: false as const, reason: "пустой ответ" };
    }
    return { ok: true as const, absolutePath, skipped: Boolean(r.skipped) };
  };

  let step = 0;
  const total = tasks.length;

  for (const task of tasks) {
    step += 1;
    args.onProgress?.(step, total, task.label);

    const applyPath = (absolutePath: string, fileName: string) => {
      if (task.kind === "video") {
        const video = videos[task.index];
        videos[task.index] = { ...video, file: fileName, filePath: absolutePath };
      } else {
        const hold = holdImages[task.index];
        holdImages[task.index] = { ...hold, file: fileName, filePath: absolutePath };
      }
      changed = true;
    };

    if (task.hadFilePath) {
      const localPath = await resolveLocalPath(task.kind, task.fileName);
      if (localPath) {
        stats.alreadyLocal += 1;
        continue;
      }
    }

    const localPath = await resolveLocalPath(task.kind, task.fileName);
    if (localPath) {
      applyPath(localPath, task.fileName);
      stats.localFound += 1;
      continue;
    }

    if (!args.accessToken) {
      stats.failed.push({
        kind: task.kind,
        label: task.label,
        reason: "нужен вход в аккаунт и интернет для первой загрузки",
      });
      continue;
    }

    const url = await resolveRemoteDownloadUrl(args.accessToken, task.key, task.remoteUrl);
    if (!isHttpUrl(url)) {
      stats.failed.push({
        kind: task.kind,
        label: task.label,
        reason: "нет ссылки — проверьте интернет и синхронизацию",
      });
      continue;
    }

    const res = await downloadOne(task.kind, task.fileName, url);
    if (!res.ok) {
      stats.failed.push({ kind: task.kind, label: task.label, reason: res.reason });
      continue;
    }
    applyPath(res.absolutePath, task.fileName);
    if (res.skipped) stats.localFound += 1;
    else stats.downloaded += 1;
  }

  if (changed) {
    const projector = (base as any)?.projector;
    const payload: Record<string, unknown> = {
      ...(base as object),
      videos,
      holdImages,
      projector,
      projectorMedia: packProjectorMedia({ videos, holdImages, projector }),
    };
    await desktopSaveProjectScene(desktop, args.projectSlug, "script", payload, {
      skipOutbox: true,
    });
  }

  const resultBody = {
    changed,
    videos,
    holdImages,
    ...stats,
  };

  return {
    ok: stats.failed.length === 0 || stats.downloaded + stats.localFound + stats.alreadyLocal > 0,
    ...resultBody,
    message: buildResultMessage(resultBody),
  };
}

/** @deprecated используйте downloadDesktopProjectorMediaOffline */
export async function ensureDesktopProjectorMediaOffline(args: {
  projectSlug: string;
  accessToken: string | null;
  projectId: string | null;
}): Promise<{ changed: boolean; videos: SceneVideo[]; holdImages: SceneHoldImage[] } | null> {
  const result = await downloadDesktopProjectorMediaOffline(args);
  if (!getDesktopApi()?.invoke) return null;
  return {
    changed: result.changed,
    videos: result.videos,
    holdImages: result.holdImages,
  };
}
