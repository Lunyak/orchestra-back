/**
 * Контракт медиа для окна проектора (другой document).
 * blob: URL из основного окна туда не работает — их нельзя слать по BroadcastChannel.
 */

export function isWindowLocalMediaUrl(url: string | null | undefined): boolean {
  return String(url ?? "").trim().toLowerCase().startsWith("blob:");
}

/** Убирает src, который живёт только в документе-отправителе. */
export function sanitizeCrossWindowMediaSrc(
  src: string | null | undefined,
): string | null {
  const value = String(src ?? "").trim();
  if (!value) return null;
  if (isWindowLocalMediaUrl(value)) return null;
  return value;
}

export function normalizeProjectorFileName(
  fileName: string | null | undefined,
): string | null {
  const clean = String(fileName ?? "")
    .trim()
    .replace(/^.*[/\\]/, "");
  return clean || null;
}

export type ProjectorMediaLoadPlan = {
  storageKey: string | null;
  /** Безопасный для чужого окна URL (не blob:). */
  crossWindowSrc: string | null;
  fileName: string | null;
  projectSlug: string | null;
  /** Исходный src был blob: — без storageKey/fileName зал останется чёрным. */
  droppedWindowLocalSrc: boolean;
};

export function buildProjectorMediaLoadPlan(input: {
  storageKey?: string | null;
  src?: string | null;
  fileName?: string | null;
  projectSlug?: string | null;
}): ProjectorMediaLoadPlan {
  const rawSrc = String(input.src ?? "").trim();
  const droppedWindowLocalSrc = isWindowLocalMediaUrl(rawSrc);
  return {
    storageKey: String(input.storageKey ?? "").trim() || null,
    crossWindowSrc: sanitizeCrossWindowMediaSrc(rawSrc),
    fileName: normalizeProjectorFileName(input.fileName),
    projectSlug: String(input.projectSlug ?? "").trim() || null,
    droppedWindowLocalSrc,
  };
}

/**
 * Порядок источников для окна проектора.
 * storageKey → локальный файл в ЭТОМ окне → безопасный URL.
 */
export type ProjectorMediaSourceStep =
  | { kind: "storageKey"; storageKey: string }
  | { kind: "localFile"; projectSlug: string; fileName: string }
  | { kind: "url"; src: string };

export function listProjectorMediaSourceSteps(
  plan: ProjectorMediaLoadPlan,
): ProjectorMediaSourceStep[] {
  const steps: ProjectorMediaSourceStep[] = [];
  if (plan.storageKey) {
    steps.push({ kind: "storageKey", storageKey: plan.storageKey });
  }
  if (plan.projectSlug && plan.fileName) {
    steps.push({
      kind: "localFile",
      projectSlug: plan.projectSlug,
      fileName: plan.fileName,
    });
  }
  if (plan.crossWindowSrc) {
    steps.push({ kind: "url", src: plan.crossWindowSrc });
  }
  return steps;
}

export function canResolveProjectorMedia(plan: ProjectorMediaLoadPlan): boolean {
  return listProjectorMediaSourceSteps(plan).length > 0;
}

export type ShowHoldCommandInput = {
  holdId: number | null;
  projectSlug: string;
  storageKey?: string | null;
  src?: string | null;
  fileName?: string | null;
  fadeMs?: number;
};

export type ShowHoldCommand = {
  type: "show-hold";
  src: string | null;
  storageKey: string | null;
  holdId: number | null;
  fileName: string | null;
  projectSlug: string | null;
  fadeMs?: number;
};

export function buildShowHoldCommand(input: ShowHoldCommandInput): ShowHoldCommand {
  const plan = buildProjectorMediaLoadPlan({
    storageKey: input.storageKey,
    src: input.src,
    fileName: input.fileName,
    projectSlug: input.projectSlug,
  });
  const fadeMs =
    input.fadeMs != null && Number.isFinite(input.fadeMs) && input.fadeMs > 0
      ? Math.round(input.fadeMs)
      : undefined;
  return {
    type: "show-hold",
    src: plan.crossWindowSrc,
    storageKey: plan.storageKey,
    holdId: input.holdId,
    fileName: plan.fileName,
    projectSlug: plan.projectSlug,
    ...(fadeMs != null ? { fadeMs } : {}),
  };
}

export type ShowVideoCommandInput = {
  videoId: number;
  projectSlug: string;
  storageKey?: string | null;
  src?: string | null;
  fileName?: string | null;
  holdId?: number | null;
  holdSrc?: string | null;
  holdStorageKey?: string | null;
  holdFileName?: string | null;
  muted?: boolean;
  volume?: number;
  fadeMs?: number;
};

export type ShowVideoCommand = {
  type: "show-video";
  src: string;
  storageKey: string | null;
  fileName: string | null;
  projectSlug: string | null;
  holdSrc: string | null;
  holdStorageKey: string | null;
  holdFileName: string | null;
  holdId: number | null;
  videoId: number;
  muted?: boolean;
  volume?: number;
  fadeMs?: number;
};

export function buildShowVideoCommand(input: ShowVideoCommandInput): ShowVideoCommand {
  const videoPlan = buildProjectorMediaLoadPlan({
    storageKey: input.storageKey,
    src: input.src,
    fileName: input.fileName,
    projectSlug: input.projectSlug,
  });
  const holdPlan = buildProjectorMediaLoadPlan({
    storageKey: input.holdStorageKey,
    src: input.holdSrc,
    fileName: input.holdFileName,
    projectSlug: input.projectSlug,
  });
  const fadeMs =
    input.fadeMs != null && Number.isFinite(input.fadeMs) && input.fadeMs > 0
      ? Math.round(input.fadeMs)
      : undefined;
  return {
    type: "show-video",
    src: videoPlan.crossWindowSrc ?? "",
    storageKey: videoPlan.storageKey,
    fileName: videoPlan.fileName,
    projectSlug: videoPlan.projectSlug,
    holdSrc: holdPlan.crossWindowSrc,
    holdStorageKey: holdPlan.storageKey,
    holdFileName: holdPlan.fileName,
    holdId: input.holdId ?? null,
    videoId: input.videoId,
    muted: input.muted,
    volume: input.volume,
    ...(fadeMs != null ? { fadeMs } : {}),
  };
}
