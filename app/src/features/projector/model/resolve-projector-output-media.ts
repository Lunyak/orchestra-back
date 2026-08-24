import {
  resolveBrowserPickedMediaUrl,
  restoreBrowserMediaFolder,
} from "../../../shared/platform/browser-picked-media";
import {
  buildProjectorMediaLoadPlan,
  listProjectorMediaSourceSteps,
  type ProjectorMediaLoadPlan,
} from "./projector-cross-window-media";
import {
  fetchProjectorImageBlobUrl,
  fetchProjectorVideoBlobUrl,
} from "./projector-media";

export type ResolveProjectorOutputMediaInput = {
  storageKey?: string | null;
  src?: string | null;
  fileName?: string | null;
  projectSlug?: string | null;
  kind: "image" | "video";
};

async function resolveLocalFileInThisWindow(
  projectSlug: string,
  fileName: string,
): Promise<string | null> {
  const direct = resolveBrowserPickedMediaUrl(fileName, undefined, projectSlug);
  if (direct) return direct;

  const restored = await restoreBrowserMediaFolder(projectSlug);
  if (!restored.ok) return null;
  return resolveBrowserPickedMediaUrl(fileName, undefined, projectSlug);
}

/**
 * Резолв медиа внутри окна проектора.
 * Не использует blob: из другого окна — только storageKey / локальный кэш этого окна / безопасный URL.
 */
export async function resolveProjectorOutputMediaSrc(
  input: ResolveProjectorOutputMediaInput,
): Promise<{ src: string; from: "storageKey" | "localFile" | "url" } | null> {
  const plan: ProjectorMediaLoadPlan = buildProjectorMediaLoadPlan(input);
  const steps = listProjectorMediaSourceSteps(plan);

  for (const step of steps) {
    if (step.kind === "storageKey") {
      const blobUrl =
        input.kind === "video"
          ? await fetchProjectorVideoBlobUrl(step.storageKey)
          : await fetchProjectorImageBlobUrl(step.storageKey);
      if (blobUrl) return { src: blobUrl, from: "storageKey" };
      continue;
    }
    if (step.kind === "localFile") {
      const local = await resolveLocalFileInThisWindow(
        step.projectSlug,
        step.fileName,
      );
      if (local) return { src: local, from: "localFile" };
      continue;
    }
    if (step.kind === "url") {
      return { src: step.src, from: "url" };
    }
  }

  return null;
}
