import type { KadrProjectorCue } from "../../theater/model/kadr-projector";
import { sendProjectorMessage } from "../../projector/model/projector-playback-bridge";
import {
  buildShowHoldCommand,
  buildShowVideoCommand,
} from "../../projector/model/projector-cross-window-media";
import { normalizeProjectorTransitionMs } from "../../projector/model/projector-video-preview";
import {
  resolveDefaultHoldId,
  resolveProjectorHoldAsset,
  resolveProjectorVideoAsset,
  type ProjectorMediaContext,
} from "../../projector/model/projector-media";

function resolveTransitionMs(ctx: ProjectorMediaContext): number | undefined {
  const ms = normalizeProjectorTransitionMs(ctx.projector?.transitionMs);
  return ms > 0 ? ms : undefined;
}

export async function applyKadrProjector(
  cue: KadrProjectorCue | null | undefined,
  ctx: ProjectorMediaContext,
  options?: { videoMuted?: boolean; videoVolume?: number },
) {
  if (!cue) return;

  const defaultHoldId = resolveDefaultHoldId(ctx);
  const defaultHold = resolveProjectorHoldAsset(ctx, defaultHoldId);
  const fadeMs = resolveTransitionMs(ctx);

  if (cue.mode === "hold") {
    const holdId = cue.holdId ?? defaultHoldId;
    const asset = resolveProjectorHoldAsset(ctx, holdId);
    sendProjectorMessage(
      buildShowHoldCommand({
        holdId: holdId ?? null,
        projectSlug: ctx.projectSlug,
        storageKey: asset?.storageKey ?? null,
        src: asset?.fallbackSrc ?? null,
        fileName: asset?.fileName ?? null,
        fadeMs,
      }),
    );
    return;
  }

  const videoAsset = resolveProjectorVideoAsset(ctx, cue.videoId);
  if (!videoAsset?.storageKey && !videoAsset?.fallbackSrc && !videoAsset?.fileName) {
    sendProjectorMessage(
      buildShowHoldCommand({
        holdId: defaultHoldId,
        projectSlug: ctx.projectSlug,
        storageKey: defaultHold?.storageKey ?? null,
        src: defaultHold?.fallbackSrc ?? null,
        fileName: defaultHold?.fileName ?? null,
        fadeMs,
      }),
    );
    return;
  }

  sendProjectorMessage(
    buildShowVideoCommand({
      videoId: cue.videoId,
      projectSlug: ctx.projectSlug,
      storageKey: videoAsset?.storageKey ?? null,
      src: videoAsset?.fallbackSrc ?? null,
      fileName: videoAsset?.fileName ?? null,
      holdId: defaultHoldId,
      holdSrc: defaultHold?.fallbackSrc ?? null,
      holdStorageKey: defaultHold?.storageKey ?? null,
      holdFileName: defaultHold?.fileName ?? null,
      muted: options?.videoMuted ?? (options?.videoVolume ?? 1) === 0,
      volume: options?.videoVolume ?? (options?.videoMuted ? 0 : 1),
      fadeMs,
    }),
  );
}

export function showProjectorHold(
  ctx: ProjectorMediaContext,
  holdId?: number | null,
) {
  const resolvedId = holdId ?? resolveDefaultHoldId(ctx);
  const asset = resolveProjectorHoldAsset(ctx, resolvedId);
  sendProjectorMessage(
    buildShowHoldCommand({
      holdId: resolvedId,
      projectSlug: ctx.projectSlug,
      storageKey: asset?.storageKey ?? null,
      src: asset?.fallbackSrc ?? null,
      fileName: asset?.fileName ?? null,
      fadeMs: resolveTransitionMs(ctx),
    }),
  );
}
