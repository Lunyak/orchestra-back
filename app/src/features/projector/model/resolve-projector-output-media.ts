import {
  resolveBrowserPickedMediaUrl,
  restoreBrowserMediaFolder,
} from "../../../shared/platform/browser-picked-media";
import {
  buildProjectorMediaLoadPlan,
  isWindowLocalMediaUrl,
  listProjectorMediaSourceSteps,
  type ProjectorMediaLoadPlan,
} from "./projector-cross-window-media";
import {
  fetchProjectorImageBlobUrl,
  fetchProjectorPlayUrl,
  fetchProjectorVideoBlobUrl,
} from "./projector-media";

export type ResolveProjectorOutputMediaInput = {
  storageKey?: string | null;
  src?: string | null;
  fileName?: string | null;
  projectSlug?: string | null;
  kind: "image" | "video";
  /** Если play-url не запустился в <video>, повторить через полную загрузку. */
  preferBlob?: boolean;
  /** Источники, которые уже не открылись — взять следующий. */
  skipSrcs?: string[];
};

export type ResolvedProjectorOutputMedia = {
  src: string;
  from: "playUrl" | "storageKey" | "localFile" | "url";
  blob: boolean;
};

async function resolveLocalFileInThisWindow(
  projectSlug: string,
  fileName: string,
): Promise<string | null> {
  try {
    const direct = resolveBrowserPickedMediaUrl(fileName, undefined, projectSlug);
    if (direct) return direct;

    const restored = await restoreBrowserMediaFolder(projectSlug);
    if (!restored.ok) return null;
    return resolveBrowserPickedMediaUrl(fileName, undefined, projectSlug);
  } catch {
    return null;
  }
}

function shouldSkipResolvedSrc(src: string, skipSrcs: Set<string>): boolean {
  return skipSrcs.has(src);
}

/**
 * Резолв медиа внутри окна проектора.
 * Не использует blob: из другого окна — только storageKey / локальный кэш этого окна / безопасный URL.
 * Видео сначала стримит по play-url, полный blob — только запасной путь.
 */
export async function resolveProjectorOutputMediaSrc(
  input: ResolveProjectorOutputMediaInput,
): Promise<ResolvedProjectorOutputMedia | null> {
  const plan: ProjectorMediaLoadPlan = buildProjectorMediaLoadPlan(input);
  const steps = listProjectorMediaSourceSteps(plan, input.kind);
  const skipSrcs = new Set(
    (input.skipSrcs ?? []).map((src) => String(src ?? "").trim()).filter(Boolean),
  );

  for (const step of steps) {
    try {
      if (step.kind === "playUrl") {
        if (input.preferBlob) continue;
        const playUrl = await fetchProjectorPlayUrl(step.storageKey);
        if (playUrl && !shouldSkipResolvedSrc(playUrl, skipSrcs)) {
          return { src: playUrl, from: "playUrl", blob: false };
        }
        continue;
      }
      if (step.kind === "storageKey") {
        const blobUrl =
          input.kind === "video"
            ? await fetchProjectorVideoBlobUrl(step.storageKey)
            : await fetchProjectorImageBlobUrl(step.storageKey);
        if (blobUrl && !shouldSkipResolvedSrc(blobUrl, skipSrcs)) {
          return { src: blobUrl, from: "storageKey", blob: true };
        }
        continue;
      }
      if (step.kind === "localFile") {
        const local = await resolveLocalFileInThisWindow(
          step.projectSlug,
          step.fileName,
        );
        if (local && !shouldSkipResolvedSrc(local, skipSrcs)) {
          return {
            src: local,
            from: "localFile",
            blob: isWindowLocalMediaUrl(local),
          };
        }
        continue;
      }
      if (step.kind === "url") {
        if (input.preferBlob) continue;
        if (shouldSkipResolvedSrc(step.src, skipSrcs)) continue;
        return { src: step.src, from: "url", blob: false };
      }
    } catch {
      continue;
    }
  }

  return null;
}
