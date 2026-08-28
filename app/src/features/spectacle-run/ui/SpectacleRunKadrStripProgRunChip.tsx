import { useState, type KeyboardEvent, type MouseEvent, type Ref } from "react";

import cn from "classnames";

import { LightConsoleView } from "../../../shared/components/light-console/LightConsoleView";
import { ProjectorMediaPreview } from "../../projector/ui/ProjectorMediaPreview";
import { resolveDefaultHoldId } from "../../projector/model/projector-media";
import { formatKadrRunLabelText, type KadrRunLabel } from "../model/kadr-section-labels";
import type { KadrStripTechRow } from "../model/kadr-strip-tech-summary";
import {
  COVER_OVERLAY_LIVE_ROW_LABELS,
  isFilledTechRow,
  LIVE_PROG_RUN_ROW_LABELS,
  LIVE_PROG_RUN_ROW_LABEL_SET,
  NOTES_PROG_RUN_ROW_LABELS,
  NOTES_PROG_RUN_ROW_LABEL_SET,
  orderTechRowsByLabels,
  PRIMARY_PROG_RUN_ROW_LABELS,
} from "../model/kadr-strip-chip-utils";
import type { SpectacleRunKadrStripProgRunChipProps } from "../model/spectacle-run-kadr-strip-types";
import { useKadrStripChipImage } from "../model/useKadrStripChipImage";
import { SpectacleRunKadrStripChipFieldValue } from "./SpectacleRunKadrStripChipFieldValue";

export type { SpectacleRunKadrStripProgRunChipProps };

export function SpectacleRunKadrStripProgRunChip({
  projectName,
  item,
  imageHref,
  summary,
  projectorCtx,
  active,
  programColor,
  title,
  chipNo,
  onSelect,
  chipRef,
  tapeIndex,
  carouselOffset,
  carouselStacked,
  notesOverlay = false,
  plainCover = false,
  lightConsoleOpen = false,
  chipLightConsole = null,
  lightConsoleChannelColumns,
  sceneSpotlights = [],
}: SpectacleRunKadrStripProgRunChipProps) {
  const [requisitesOpen, setRequisitesOpen] = useState(false);
  const { imageSrc, onImageError, hasThumb, fallbackColor, chipAccentStyle } =
    useKadrStripChipImage(
      projectName,
      plainCover ? null : imageHref,
      plainCover ? null : programColor,
    );

  const filledRows = summary.rows.filter(isFilledTechRow);
  const preferredRows = filledRows.filter((row) =>
    PRIMARY_PROG_RUN_ROW_LABELS.has(row.label),
  );
  const unorderedPrimary =
    preferredRows.length > 0 ? preferredRows : filledRows.slice(0, 5);

  const liveRows = orderTechRowsByLabels(
    unorderedPrimary.filter((row) => LIVE_PROG_RUN_ROW_LABEL_SET.has(row.label)),
    LIVE_PROG_RUN_ROW_LABELS,
  );
  const coverLiveRows = orderTechRowsByLabels(
    liveRows.filter((row) => row.label === "Свет" || row.label === "Трек"),
    COVER_OVERLAY_LIVE_ROW_LABELS,
  );
  const coverLightRow = coverLiveRows.find((row) => row.label === "Свет") ?? null;
  const coverTrackRow = coverLiveRows.find((row) => row.label === "Трек") ?? null;
  const bodyLiveRows = notesOverlay
    ? liveRows.filter((row) => row.label === "Видео")
    : liveRows;
  const notesRows = orderTechRowsByLabels(
    unorderedPrimary.filter((row) => NOTES_PROG_RUN_ROW_LABEL_SET.has(row.label)),
    NOTES_PROG_RUN_ROW_LABELS,
  );

  const primaryLabelSet = new Set(unorderedPrimary.map((row) => row.label));
  const hiddenRowCount = filledRows.filter((row) => !primaryLabelSet.has(row.label)).length;
  const requisiteItems = summary.requisites;
  const hasRequisites = requisiteItems.length > 0;
  const hasCoverLiveRows = coverLiveRows.length > 0;
  const hasBodyLiveRows = bodyLiveRows.length > 0;
  const commentRows = notesRows.filter((row) => row.label === "Комментарий");
  const transitionRow = notesRows.find((row) => row.label === "Переход");
  const hasCommentRows = commentRows.length > 0;
  const hasTransition = transitionRow != null;
  const showConsoleSlot =
    lightConsoleOpen && (chipLightConsole != null || summary.blackout);
  const showChipConsole = chipLightConsole != null;
  const showLiveInBody = hasBodyLiveRows;
  const showLiveOnCover = notesOverlay && hasCoverLiveRows;
  const showNotesDivider = hasCommentRows && (showLiveInBody || hasRequisites);
  const hasFields =
    showLiveInBody ||
    hasCommentRows ||
    hasTransition ||
    hasRequisites ||
    hiddenRowCount > 0;

  const cornerLabels = summary.cornerLabels.filter(
    (label) => !(summary.blackout && label.type === "blackout"),
  );
  const projectorPreview = summary.projectorPreview;
  const coverHoldId =
    projectorPreview?.mode === "hold"
      ? projectorPreview.holdId ??
        (projectorCtx ? resolveDefaultHoldId(projectorCtx) : null)
      : null;

  const showPlainCover = plainCover;
  const showImageCover = !plainCover && hasThumb;
  const showProjectorCover =
    !plainCover &&
    !showImageCover &&
    projectorPreview != null &&
    projectorCtx != null &&
    (projectorPreview.mode === "video"
      ? projectorPreview.videoId != null && projectorPreview.videoId > 0
      : true);

  const handleChipKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  };

  const handleRequisitesToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setRequisitesOpen((prev) => !prev);
  };

  const renderCornerLabel = (label: KadrRunLabel) => (
    <span
      key={label.type}
      className={cn(
        "spectacle-run-kadr-strip__chip-corner-label",
        label.type === "blackout" && "spectacle-run-kadr-strip__chip-corner-label--blackout",
        (label.type === "smoke" || label.type === "smoke-machine") &&
          "spectacle-run-kadr-strip__chip-corner-label--smoke",
      )}
    >
      {formatKadrRunLabelText(label)}
    </span>
  );

  const renderCoverFieldRow = (row: KadrStripTechRow) => (
    <span
      key={row.label}
      className={cn(
        "spectacle-run-kadr-strip__chip-cover-field",
        row.label === "Трек" && "spectacle-run-kadr-strip__chip-cover-field--track",
      )}
    >
      <span className="spectacle-run-kadr-strip__chip-cover-field-label">{row.label}</span>
      <span
        className={cn(
          "spectacle-run-kadr-strip__chip-cover-field-value",
          row.multiline && "spectacle-run-kadr-strip__chip-cover-field-value--multiline",
        )}
        title={row.value}
      >
        {row.value}
      </span>
    </span>
  );

  const renderFieldRow = (row: KadrStripTechRow) => (
    <span
      key={row.label}
      className={cn(
        "spectacle-run-kadr-strip__chip-field",
        row.label === "Трек" && "spectacle-run-kadr-strip__chip-field--track",
        row.label === "Видео" && "spectacle-run-kadr-strip__chip-field--video",
      )}
    >
      {row.label !== "Видео" ? (
        <span className="spectacle-run-kadr-strip__chip-field-label">{row.label}</span>
      ) : null}
      <SpectacleRunKadrStripChipFieldValue
        row={row}
        projectorCtx={projectorCtx}
        hideProjectorPreview={showProjectorCover}
      />
    </span>
  );

  return (
    <div
      ref={chipRef as Ref<HTMLDivElement> | undefined}
      role="button"
      tabIndex={0}
      className="spectacle-run-kadr-strip__chip"
      data-active={active}
      data-tape-index={tapeIndex}
      data-carousel-offset={carouselOffset}
      data-carousel-stack={carouselStacked ? "true" : undefined}
      data-placeholder={item.isPlaceholder ? "true" : undefined}
      data-has-thumb={showImageCover || showProjectorCover ? "true" : undefined}
      data-plain-cover={showPlainCover ? "true" : undefined}
      data-has-fallback-color={!showPlainCover && fallbackColor ? "true" : undefined}
      data-blackout={summary.blackout ? "true" : undefined}
      style={chipAccentStyle}
      title={title}
      onClick={onSelect}
      onKeyDown={handleChipKeyDown}
    >
      <span className="spectacle-run-kadr-strip__chip-layout spectacle-run-kadr-strip__chip-layout--stack">
        <span
          className={cn(
            "spectacle-run-kadr-strip__chip-cover",
            showPlainCover && "spectacle-run-kadr-strip__chip-cover--plain",
            (showImageCover || showProjectorCover) && "spectacle-run-kadr-strip__chip-cover--thumb",
          )}
          aria-hidden
        >
          {showImageCover ? (
            <img
              src={imageSrc ?? undefined}
              alt=""
              className="spectacle-run-kadr-strip__chip-cover-img"
              onError={onImageError}
            />
          ) : showProjectorCover && projectorPreview && projectorCtx ? (
            <ProjectorMediaPreview
              ctx={projectorCtx}
              mode={projectorPreview.mode}
              videoId={projectorPreview.videoId}
              holdId={coverHoldId}
              title={projectorPreview.title}
              className="spectacle-run-kadr-strip__chip-cover-preview"
              fallbackClassName="spectacle-run-kadr-strip__chip-cover-fallback"
              hideFallbackLabel
            />
          ) : null}
          <span className="spectacle-run-kadr-strip__chip-header">
            <span className="spectacle-run-kadr-strip__chip-number">{chipNo}</span>
            {summary.headingTitle ? (
              <span className="spectacle-run-kadr-strip__chip-title" title={summary.headingTitle}>
                {summary.headingTitle}
              </span>
            ) : null}
            {cornerLabels.length > 0 ? (
              <span className="spectacle-run-kadr-strip__chip-header-labels">
                {cornerLabels.map(renderCornerLabel)}
              </span>
            ) : null}
          </span>
          {showLiveOnCover ? (
            <span className="spectacle-run-kadr-strip__chip-cover-fields">
              {coverTrackRow ? (
                <span className="spectacle-run-kadr-strip__chip-cover-fields-zone spectacle-run-kadr-strip__chip-cover-fields-zone--top">
                  {renderCoverFieldRow(coverTrackRow)}
                </span>
              ) : null}
              {coverLightRow ? (
                <span className="spectacle-run-kadr-strip__chip-cover-fields-zone spectacle-run-kadr-strip__chip-cover-fields-zone--bottom">
                  {renderCoverFieldRow(coverLightRow)}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>

        <span
          className={cn(
            "spectacle-run-kadr-strip__chip-body",
            hasTransition && "spectacle-run-kadr-strip__chip-body--with-transition",
            showConsoleSlot && "spectacle-run-kadr-strip__chip-body--with-console",
          )}
        >
          {showConsoleSlot ? (
            showChipConsole && chipLightConsole ? (
              <span
                className="spectacle-run-kadr-strip__chip-console"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <LightConsoleView
                  mode="compact"
                  readOnly
                  lightChannels={chipLightConsole.lightChannels}
                  selectedLightSlot={chipLightConsole.selectedLightSlot}
                  faders={chipLightConsole.faders}
                  programs={chipLightConsole.programs}
                  spotlights={sceneSpotlights}
                  consoleChannel={chipLightConsole.selectedLightSlot}
                  channelColumns={lightConsoleChannelColumns}
                  className="spectacle-run-kadr-strip__chip-console-view"
                />
              </span>
            ) : (
              <span className="spectacle-run-kadr-strip__chip-console spectacle-run-kadr-strip__chip-console--blackout">
                <span className="spectacle-run-kadr-strip__chip-console-blackout">Blackout</span>
              </span>
            )
          ) : null}

          {hasFields ? (
            <span className="spectacle-run-kadr-strip__chip-fields">
              {showLiveInBody ? (
                <span className="spectacle-run-kadr-strip__chip-fields-live">
                  {bodyLiveRows.map(renderFieldRow)}
                </span>
              ) : null}
              {hasRequisites ? (
                <span
                  className={cn(
                    "spectacle-run-kadr-strip__chip-requisites",
                    requisitesOpen && "spectacle-run-kadr-strip__chip-requisites--open",
                  )}
                >
                  <button
                    type="button"
                    className="spectacle-run-kadr-strip__chip-requisites-toggle"
                    aria-expanded={requisitesOpen}
                    onClick={handleRequisitesToggle}
                  >
                    <span
                      className="spectacle-run-kadr-strip__chip-requisites-chevron"
                      aria-hidden
                    >
                      {requisitesOpen ? "▾" : "▸"}
                    </span>
                    <span className="spectacle-run-kadr-strip__chip-requisites-title">
                      Реквизит
                    </span>
                    <span className="spectacle-run-kadr-strip__chip-requisites-count">
                      {requisiteItems.length}
                    </span>
                  </button>
                  {requisitesOpen ? (
                    <span className="spectacle-run-kadr-strip__chip-requisites-list">
                      {requisiteItems.map((itemRow, index) => {
                        const line = `${itemRow.actionLabel} · ${itemRow.name}`;
                        return (
                          <span
                            key={`${itemRow.name}-${itemRow.actionLabel}-${index}`}
                            className="spectacle-run-kadr-strip__chip-requisites-item"
                            title={line}
                          >
                            {line}
                          </span>
                        );
                      })}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {hasCommentRows ? (
                <span
                  className={cn(
                    "spectacle-run-kadr-strip__chip-fields-notes",
                    showNotesDivider && "spectacle-run-kadr-strip__chip-fields-notes--divided",
                  )}
                >
                  {commentRows.map(renderFieldRow)}
                </span>
              ) : null}
              {hiddenRowCount > 0 ? (
                <span className="spectacle-run-kadr-strip__chip-more">ещё {hiddenRowCount}</span>
              ) : null}
            </span>
          ) : item.isPlaceholder ? (
            <span className="spectacle-run-kadr-strip__chip-empty">нет картин в сцене</span>
          ) : (
            <span className="spectacle-run-kadr-strip__chip-empty">—</span>
          )}

          {hasTransition && transitionRow ? (
            <span className="spectacle-run-kadr-strip__chip-transition">
              <span
                className={cn(
                  "spectacle-run-kadr-strip__chip-transition-value",
                  transitionRow.multiline &&
                    "spectacle-run-kadr-strip__chip-transition-value--multiline",
                )}
                title={transitionRow.value}
              >
                {transitionRow.value}
              </span>
            </span>
          ) : null}
        </span>
      </span>
    </div>
  );
}
