import type { KadrProjectorCue } from "../../theater/model/kadr-projector";
import {
  isProjectorWindowOpen,
  sendProjectorMessage,
} from "../../projector/model/projector-playback-bridge";
import {
  resolveDefaultHoldId,
  resolveProjectorHoldAsset,
  resolveProjectorVideoAsset,
  type ProjectorMediaContext,
} from "../../projector/model/projector-media";

export async function applyKadrProjector(
  cue: KadrProjectorCue | null | undefined,
  ctx: ProjectorMediaContext,
  options?: { videoMuted?: boolean },
) {
  if (!isProjectorWindowOpen() || !cue) return;

  const defaultHoldId = resolveDefaultHoldId(ctx);
  const defaultHold = resolveProjectorHoldAsset(ctx, defaultHoldId);

  if (cue.mode === "hold") {
    const holdId = cue.holdId ?? defaultHoldId;
    const asset = resolveProjectorHoldAsset(ctx, holdId);
    sendProjectorMessage({
      type: "show-hold",
      src: asset?.fallbackSrc ?? null,
      storageKey: asset?.storageKey ?? null,
      holdId: holdId ?? null,
    });
    return;
  }

  const videoAsset = resolveProjectorVideoAsset(ctx, cue.videoId);
  if (!videoAsset?.storageKey && !videoAsset?.fallbackSrc) {
    sendProjectorMessage({
      type: "show-hold",
      src: defaultHold?.fallbackSrc ?? null,
      storageKey: defaultHold?.storageKey ?? null,
      holdId: defaultHoldId,
    });
    return;
  }

  sendProjectorMessage({
    type: "show-video",
    src: videoAsset.fallbackSrc ?? "",
    storageKey: videoAsset.storageKey,
    holdSrc: defaultHold?.fallbackSrc ?? null,
    holdStorageKey: defaultHold?.storageKey ?? null,
    holdId: defaultHoldId,
    videoId: cue.videoId,
    muted: options?.videoMuted ?? false,
  });
}

export function showProjectorHold(
  ctx: ProjectorMediaContext,
  holdId?: number | null,
) {
  if (!isProjectorWindowOpen()) return;
  const resolvedId = holdId ?? resolveDefaultHoldId(ctx);
  const asset = resolveProjectorHoldAsset(ctx, resolvedId);
  sendProjectorMessage({
    type: "show-hold",
    src: asset?.fallbackSrc ?? null,
    storageKey: asset?.storageKey ?? null,
    holdId: resolvedId,
  });
}
