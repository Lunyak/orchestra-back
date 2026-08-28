import cn from "classnames";
import { buildFormatPlayMetaMessage } from "../model/format-play-text-meta-message";
import type { FormatPlayPreviewStats } from "../model/useFormatPlayTextModal";

export type FormatPlayTextMetaStatusProps = {
  hasUnmatchedMarkers: boolean;
  unmatchedMarkers: string[];
  displayWarningsCount: number;
  warningsSummary: string;
  stats: FormatPlayPreviewStats;
  lineEditCount: number;
  useRoleMarkers: boolean;
  enabledRoleCount: number;
  splitBlocked: boolean;
  splitIntoScenes: boolean;
  sceneChunksCount: number;
  previewUnchanged: boolean;
};

export function FormatPlayTextMetaStatus({
  hasUnmatchedMarkers,
  unmatchedMarkers,
  displayWarningsCount,
  warningsSummary,
  stats,
  lineEditCount,
  useRoleMarkers,
  enabledRoleCount,
  splitBlocked,
  splitIntoScenes,
  sceneChunksCount,
  previewUnchanged,
}: FormatPlayTextMetaStatusProps) {
  const isWarn = hasUnmatchedMarkers || displayWarningsCount > 0;
  const message = buildFormatPlayMetaMessage({
    hasUnmatchedMarkers,
    unmatchedMarkers,
    displayWarningsCount,
    warningsSummary,
    stats,
    lineEditCount,
    useRoleMarkers,
    enabledRoleCount,
    splitBlocked,
    splitIntoScenes,
    sceneChunksCount,
    previewUnchanged,
  });

  return (
    <div
      className={cn(
        "format-play-text-modal__meta",
        isWarn && "format-play-text-modal__meta--warn",
      )}
    >
      {message}
    </div>
  );
}
