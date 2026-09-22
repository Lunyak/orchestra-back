import cn from "classnames";

import { ProjectorMediaPreview } from "../../projector/ui/ProjectorMediaPreview";
import {
  resolveDefaultHoldId,
  type ProjectorMediaContext,
} from "../../projector/model/projector-media";
import { useSpectacleRunContext } from "../model/spectacle-run-context";
import type { KadrStripTechRow } from "../model/kadr-strip-tech-summary";
import { KadrStripVideoMutedIcon } from "./KadrStripVideoMutedIcon";
import {
  isLiveProjectorVideo,
  SpectacleRunProjectorFollowPlayer,
} from "./SpectacleRunProjectorFollowPlayer";

type SpectacleRunKadrStripChipFieldValueProps = {
  row: KadrStripTechRow;
  projectorCtx: ProjectorMediaContext | null;
  hideProjectorPreview?: boolean;
  liveEnabled?: boolean;
};

export function SpectacleRunKadrStripChipFieldValue({
  row,
  projectorCtx,
  hideProjectorPreview = false,
  liveEnabled = false,
}: SpectacleRunKadrStripChipFieldValueProps) {
  const run = useSpectacleRunContext();
  const preview = row.projectorPreview;
  const hasPreview =
    !hideProjectorPreview &&
    row.label === "Видео" &&
    preview != null &&
    projectorCtx != null;

  if (!hasPreview || !preview) {
    return (
      <span
        className={cn(
          "spectacle-run-kadr-strip__chip-field-value",
          row.multiline && "spectacle-run-kadr-strip__chip-field-value--multiline",
        )}
        title={row.value}
      >
        {row.value}
      </span>
    );
  }

  const holdId =
    preview.mode === "hold"
      ? preview.holdId ?? resolveDefaultHoldId(projectorCtx)
      : null;

  const previewTitle = preview.title.trim() || row.value.trim();
  const showVideoMutedIcon = preview.mode === "video" && preview.videoMuted === true;
  const liveVideoId =
    liveEnabled &&
    preview.mode === "video" &&
    preview.videoId != null &&
    isLiveProjectorVideo(preview.videoId, run.projectorPlayback)
      ? preview.videoId
      : null;
  const showStillPreview = liveVideoId == null;

  return (
    <span className="spectacle-run-kadr-strip__chip-field-media">
      <span
        className={cn(
          "spectacle-run-kadr-strip__chip-field-preview-wrap",
          liveVideoId != null && "spectacle-run-kadr-strip__chip-field-preview-wrap--live",
        )}
      >
        {liveVideoId != null ? (
          <SpectacleRunProjectorFollowPlayer
            videoId={liveVideoId}
            variant="field"
            className="spectacle-run-kadr-strip__chip-field-preview"
          />
        ) : (
          <ProjectorMediaPreview
            ctx={projectorCtx}
            mode={preview.mode}
            videoId={preview.videoId}
            holdId={holdId}
            title={preview.title}
            className="spectacle-run-kadr-strip__chip-field-preview"
            fallbackClassName="spectacle-run-kadr-strip__chip-field-preview-fallback"
            hideFallbackLabel
          />
        )}
        {showStillPreview && previewTitle ? (
          <span className="spectacle-run-kadr-strip__chip-field-preview-label">
            <span
              className="spectacle-run-kadr-strip__chip-field-preview-label-text"
              title={previewTitle}
            >
              {previewTitle}
            </span>
          </span>
        ) : null}
        {showStillPreview && showVideoMutedIcon ? (
          <span
            className="spectacle-run-kadr-strip__chip-field-preview-muted-icon"
            title="Без звука"
            aria-label="Без звука"
          >
            <KadrStripVideoMutedIcon />
          </span>
        ) : null}
      </span>
    </span>
  );
}
