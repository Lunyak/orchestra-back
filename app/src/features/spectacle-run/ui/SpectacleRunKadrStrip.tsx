import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from "react";

import cn from "classnames";

import type {

  PlaybookLightFadersDataV1,

  PlaybookLightProgramsDataV1,

} from "../../playbook/model/playbook-slice";

import {

  fadersForKadrDisplay,

  findKadrById,

  readSceneLightKadrs,

} from "../../theater/model/light-kadrs";

import { buildLightConsoleSplitModel } from "../../../shared/components/light-console/light-console-split";

import { resolveLightFaders, resolveLightPrograms } from "../../../shared/components/light-console/light-console-data";
import { LightConsoleView } from "../../../shared/components/light-console/LightConsoleView";

import { resolveLightColor } from "../../../shared/components/show-script/utils/lightTokens";

import type { ScriptScene, SceneLightKadrV1, TheaterSpotlight } from "../../../shared/types/script";

import {

  buildSpectacleTapeSceneGroups,

  type SpectacleTapeItem,

} from "../model/spectacle-kadr-tape";

import { parseKadrTitleFromHeading } from "../model/create-kadr-from-draft";
import { findFirstMarkdownImageHref } from "../../../shared/utils/markdownImages";

import { formatKadrRunLabelText, type KadrRunLabel } from "../model/kadr-section-labels";

import {

  buildKadrStripTechSummary,

  type KadrStripTechRow,

  type KadrStripTechSummary,

} from "../model/kadr-strip-tech-summary";

import { ProjectorMediaPreview } from "../../projector/ui/ProjectorMediaPreview";

import {

  resolveDefaultHoldId,

  type ProjectorMediaContext,

} from "../../projector/model/projector-media";

import { useKadrStripDragScroll } from "../model/useKadrStripDragScroll";

import { useKadrStripImageSrc } from "../model/useKadrStripImageSrc";

import { useProgRunKadrChipHeight } from "../model/useProgRunKadrChipHeight";

import {
  centerKadrStripChip,
  findNearestKadrStripChipIndex,
} from "../model/kadr-strip-carousel";

const PRIMARY_PROG_RUN_ROW_LABELS = new Set([
  "Свет",
  "Трек",
  "Видео",
  "Переход",
  "Комментарий",
]);

const LIVE_PROG_RUN_ROW_LABELS = ["Свет", "Трек", "Видео"] as const;

const COVER_OVERLAY_LIVE_ROW_LABELS = ["Свет", "Трек"] as const;

const NOTES_PROG_RUN_ROW_LABELS = ["Комментарий", "Переход"] as const;

const LIVE_PROG_RUN_ROW_LABEL_SET = new Set<string>(LIVE_PROG_RUN_ROW_LABELS);

const NOTES_PROG_RUN_ROW_LABEL_SET = new Set<string>(NOTES_PROG_RUN_ROW_LABELS);

const PROG_RUN_CAROUSEL_STACK_RADIUS = 2;

const PROG_RUN_FLOW_STACK_RADIUS = 3;

const PROG_RUN_TRIO_STACK_RADIUS = 1;

function isCarouselStackedOffset(
  offset: number,
  mode: "carousel" | "flow" | "trio" = "carousel",
): boolean {
  const radius =
    mode === "flow"
      ? PROG_RUN_FLOW_STACK_RADIUS
      : mode === "trio"
        ? PROG_RUN_TRIO_STACK_RADIUS
        : PROG_RUN_CAROUSEL_STACK_RADIUS;
  return Math.abs(offset) <= radius;
}

function isFilledTechRow(row: KadrStripTechRow): boolean {
  return row.value.trim().length > 0;
}

function orderTechRowsByLabels(
  rows: KadrStripTechRow[],
  labels: readonly string[],
): KadrStripTechRow[] {
  const byLabel = new Map(rows.map((row) => [row.label, row]));
  return labels.flatMap((label) => {
    const row = byLabel.get(label);
    return row ? [row] : [];
  });
}

import type { ProgRunKadrStripLayout } from "../model/prog-run-prefs-storage";

export type SpectacleRunKadrStripLayout = ProgRunKadrStripLayout;

export type SpectacleRunKadrStripVariant = "rehearsal" | "prog-run";



export type ProgRunChipLiveConsoleProps = {
  lightChannels: string[];
  selectedLightSlot: number;
  faders: PlaybookLightFadersDataV1;
  programs: PlaybookLightProgramsDataV1;
};

export type SpectacleRunKadrStripProps = {

  variant?: SpectacleRunKadrStripVariant;

  layout?: SpectacleRunKadrStripLayout;

  notesOverlay?: boolean;

  plainCover?: boolean;

  lightConsoleOpen?: boolean;

  lightConsoleChannelColumns?: number;

  projectName: string;

  tape: SpectacleTapeItem[];

  tapeIndex: number;

  scenes: ScriptScene[];

  lightChannels: string[];

  lightFaders: PlaybookLightFadersDataV1 | null;

  lightPrograms: PlaybookLightProgramsDataV1 | null;

  playlist?: Array<{ id: number; title: string }>;

  sounds?: Array<{ id: number; title: string }>;

  videos?: Array<{ id: number; title: string }>;

  holdImages?: Array<{ id: number; title: string }>;

  projectorCtx?: ProjectorMediaContext | null;

  onSelectIndex: (index: number) => void;

};



function kadrProgramColor(

  item: SpectacleTapeItem,

  scene: ScriptScene | undefined,

  lightChannels: string[],

  baseFaders: ReturnType<typeof resolveLightFaders>,

): string | null {

  if (item.isPlaceholder || !scene) return null;

  const kadrs = readSceneLightKadrs(scene);

  const kadr =

    (item.kadrId ? findKadrById(kadrs, item.kadrId) : undefined) ??

    kadrs.kadrs.find((k) => k.kadrNo === item.kadrNo);

  if (!kadr || kadr.blackout || kadr.programId <= 0) return null;

  const display = fadersForKadrDisplay(kadr, baseFaders);

  const split = buildLightConsoleSplitModel({

    programId: kadr.programId,

    lightChannels,

    faders: display,

    kadrFaderStates: kadr.faders,

    sofitChannels: [],

  });

  return split.programColor ? resolveLightColor("", split.programColor) : null;

}



function resolveTapeItemKadr(

  item: SpectacleTapeItem,

  scene: ScriptScene | undefined,

): SceneLightKadrV1 | undefined {

  if (!scene || item.isPlaceholder) return undefined;

  const kadrs = readSceneLightKadrs(scene);

  return (

    (item.kadrId ? findKadrById(kadrs, item.kadrId) : undefined) ??

    kadrs.kadrs.find((k) => k.kadrNo === item.kadrNo)

  );

}



function buildProgRunChipLightConsole(

  kadr: SceneLightKadrV1 | undefined,

  lightChannels: string[],

  baseFaders: PlaybookLightFadersDataV1,

  lightPrograms: PlaybookLightProgramsDataV1 | null,

): ProgRunChipLiveConsoleProps | null {

  if (!kadr || kadr.blackout || kadr.programId <= 0) return null;

  const channelCount = Math.max(1, lightChannels.length);

  const selectedLightSlot = Math.max(

    1,

    Math.min(channelCount, kadr.recordChannels?.[0] ?? 1),

  );

  const programId = Math.max(1, Math.trunc(kadr.programId) || 1);

  const programs = resolveLightPrograms(

    lightPrograms ?? undefined,

    undefined,

    channelCount,

  );

  return {

    lightChannels,

    selectedLightSlot,

    faders: fadersForKadrDisplay(kadr, baseFaders),

    programs: { ...programs, activeProgramId: programId },

  };

}



type KadrStripChipBaseProps = {

  projectName: string;

  item: SpectacleTapeItem;

  imageHref: string | null;

  active: boolean;

  programColor: string | null;

  title: string;

  onSelect: () => void;

  chipRef?: Ref<HTMLElement>;

  tapeIndex: number;

};



function useKadrStripChipImage(projectName: string, imageHref: string | null, programColor: string | null) {

  const { src: imageSrc, onImageError } = useKadrStripImageSrc(projectName, imageHref);

  const hasThumb = Boolean(imageSrc);

  const fallbackColor = !hasThumb ? programColor : null;

  const chipAccentStyle = fallbackColor

    ? ({ "--spectacle-run-kadr-strip-chip-accent": fallbackColor } as CSSProperties)

    : undefined;



  return { imageSrc, onImageError, hasThumb, fallbackColor, chipAccentStyle };

}



function KadrStripVideoMutedIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}



function SpectacleRunKadrStripChipFieldValue({

  row,

  projectorCtx,

  hideProjectorPreview = false,

}: {

  row: KadrStripTechRow;

  projectorCtx: ProjectorMediaContext | null;

  hideProjectorPreview?: boolean;

}) {

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

  return (

    <span className="spectacle-run-kadr-strip__chip-field-media">

      <span className="spectacle-run-kadr-strip__chip-field-preview-wrap">

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

        {previewTitle ? (
          <span className="spectacle-run-kadr-strip__chip-field-preview-label">
            <span
              className="spectacle-run-kadr-strip__chip-field-preview-label-text"
              title={previewTitle}
            >
              {previewTitle}
            </span>
          </span>
        ) : null}

        {showVideoMutedIcon ? (
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



function SpectacleRunKadrStripRehearsalChip({

  projectName,

  item,

  imageHref,

  active,

  programColor,

  title,

  label,

  onSelect,

  chipRef,

  tapeIndex,

}: KadrStripChipBaseProps & { label: string }) {

  const { imageSrc, onImageError, hasThumb, fallbackColor, chipAccentStyle } = useKadrStripChipImage(

    projectName,

    imageHref,

    programColor,

  );



  return (

    <button

      ref={chipRef}

      type="button"

      className="spectacle-run-kadr-strip__chip"

      data-active={active}

      data-tape-index={tapeIndex}

      data-placeholder={item.isPlaceholder ? "true" : undefined}

      data-has-thumb={hasThumb ? "true" : undefined}

      data-has-fallback-color={fallbackColor ? "true" : undefined}

      style={chipAccentStyle}

      title={title}

      onClick={onSelect}

    >

      <span className="spectacle-run-kadr-strip__chip-media" aria-hidden>

        {hasThumb ? (

          <img

            src={imageSrc ?? undefined}

            alt=""

            className="spectacle-run-kadr-strip__chip-thumb"

            onError={onImageError}

          />

        ) : null}

      </span>

      <span className="spectacle-run-kadr-strip__chip-label">{label}</span>

    </button>

  );

}



function SpectacleRunKadrStripProgRunChip({

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

}: KadrStripChipBaseProps & {

  summary: KadrStripTechSummary;

  projectorCtx: ProjectorMediaContext | null;

  chipNo: string;

  carouselOffset: number;

  carouselStacked: boolean;

  notesOverlay?: boolean;

  plainCover?: boolean;

  lightConsoleOpen?: boolean;

  chipLightConsole?: ProgRunChipLiveConsoleProps | null;

  lightConsoleChannelColumns?: number;

  sceneSpotlights?: TheaterSpotlight[];

}) {

  const [requisitesOpen, setRequisitesOpen] = useState(false);

  const { imageSrc, onImageError, hasThumb, fallbackColor, chipAccentStyle } = useKadrStripChipImage(

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

      ref={chipRef}

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



export function SpectacleRunKadrStrip({

  variant = "rehearsal",

  layout = "carousel",

  notesOverlay = false,

  plainCover = false,

  lightConsoleOpen = false,

  lightConsoleChannelColumns,

  projectName,

  tape,

  tapeIndex,

  scenes,

  lightChannels,

  lightFaders,

  lightPrograms,

  playlist,

  sounds,

  videos,

  holdImages,

  projectorCtx = null,

  onSelectIndex,

}: SpectacleRunKadrStripProps) {

  const isProgRun = variant === "prog-run";

  const isFlowLayout = isProgRun && layout === "flow";

  const isTrioLayout = isProgRun && layout === "trio";

  const isFlatTapeLayout = isFlowLayout || isTrioLayout;

  const isCarouselLikeLayout =
    isProgRun && (layout === "carousel" || layout === "flow" || layout === "trio");

  const activeSceneId = tape[tapeIndex]?.sceneId;

  const groups = useMemo(() => buildSpectacleTapeSceneGroups(tape), [tape]);

  const baseFaders = useMemo(

    () => resolveLightFaders(lightFaders ?? undefined),

    [lightFaders],

  );

  const media = useMemo(

    () => ({ playlist, sounds, videos, holdImages }),

    [holdImages, playlist, sounds, videos],

  );

  const trackRef = useRef<HTMLDivElement>(null);

  const stripRef = useRef<HTMLElement>(null);

  const activeChipRef = useRef<HTMLElement | null>(null);

  const carouselIgnoreUntilRef = useRef(0);

  const selectNearestCarouselChip = useCallback((options?: { snapIfSame?: boolean }) => {
    if (!isCarouselLikeLayout) return;
    if (Date.now() < carouselIgnoreUntilRef.current) return;
    const track = trackRef.current;
    if (!track || track.dataset.dragging === "true") return;
    const nearestIndex = findNearestKadrStripChipIndex(track);
    if (nearestIndex != null && nearestIndex !== tapeIndex) {
      onSelectIndex(nearestIndex);
      return;
    }
    if (!options?.snapIfSame) return;
    const chip = activeChipRef.current;
    if (!chip) return;
    carouselIgnoreUntilRef.current = Date.now() + 450;
    centerKadrStripChip(track, chip, "smooth");
  }, [isCarouselLikeLayout, onSelectIndex, tapeIndex]);

  const { consumeDrag } = useKadrStripDragScroll(trackRef, {
    onDragEnd: isCarouselLikeLayout
      ? () => {
          window.requestAnimationFrame(() => {
            selectNearestCarouselChip({ snapIfSame: true });
          });
        }
      : undefined,
  });

  const chipHeightKey = useMemo(
    () =>
      tape
        .map((item) => {
          const scene = scenes[item.sceneIndex];
          const markdownLen = String(scene?.markdown ?? "").length;
          return `${item.kadrId ?? "ph"}:${item.kadrNo}:${markdownLen}`;
        })
        .join("|"),
    [lightConsoleOpen, notesOverlay, plainCover, scenes, tape],
  );

  useProgRunKadrChipHeight(isProgRun, stripRef, chipHeightKey);

  useEffect(() => {
    const chip = activeChipRef.current;
    const track = trackRef.current;
    if (!chip || !track) return;

    if (isCarouselLikeLayout) {
      carouselIgnoreUntilRef.current = Date.now() + 450;
      centerKadrStripChip(track, chip, "smooth");
      return;
    }

    const chipLeft = chip.offsetLeft;
    const chipRight = chipLeft + chip.offsetWidth;
    const viewLeft = track.scrollLeft;
    const viewRight = viewLeft + track.clientWidth;

    if (chipLeft < viewLeft + 8 || chipRight > viewRight - 8) {
      chip.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });
    }
  }, [isCarouselLikeLayout, isProgRun, layout, tapeIndex]);

  useEffect(() => {
    if (!isCarouselLikeLayout) return;
    const track = trackRef.current;
    if (!track) return;

    let settleTimer: number | null = null;

    const settleFromScroll = () => {
      selectNearestCarouselChip();
    };

    const scheduleSettle = () => {
      if (settleTimer != null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        settleFromScroll();
      }, 140);
    };

    track.addEventListener("scroll", scheduleSettle, { passive: true });
    track.addEventListener("scrollend", settleFromScroll);

    return () => {
      if (settleTimer != null) window.clearTimeout(settleTimer);
      track.removeEventListener("scroll", scheduleSettle);
      track.removeEventListener("scrollend", settleFromScroll);
    };
  }, [isCarouselLikeLayout, selectNearestCarouselChip]);



  const renderTapeChip = (index: number, item: SpectacleTapeItem) => {

    const active = index === tapeIndex;

    const scene = scenes[item.sceneIndex];

    const programColor = kadrProgramColor(

      item,

      scene,

      lightChannels,

      baseFaders,

    );

    const chipLabel = item.isPlaceholder ? "∅" : `К${item.kadrNo}`;

    const displayKadrTitle = item.isPlaceholder
      ? ""
      : parseKadrTitleFromHeading(item.headingTitle ?? "", item.kadrNo);

    const title = item.isPlaceholder
      ? `${item.sceneTitle}: нет картин`
      : displayKadrTitle
        ? `${chipLabel} · ${displayKadrTitle}`
        : chipLabel;

    const kadrForChip = resolveTapeItemKadr(item, scene);

    const imageHref = item.isPlaceholder
      ? null
      : findFirstMarkdownImageHref(kadrForChip?.imageMarkdown ?? "");

    const chipKey = `${item.sceneId}-${item.kadrId ?? "ph"}-${item.kadrNo}-${index}`;

    const chipRef = active ? activeChipRef : undefined;

    const carouselOffset = index - tapeIndex;

    const stackMode = isTrioLayout ? "trio" : isFlowLayout ? "flow" : "carousel";

    const carouselStacked =
      isCarouselLikeLayout &&
      isCarouselStackedOffset(carouselOffset, stackMode) &&
      (isFlatTapeLayout || item.sceneId === activeSceneId);

    const onSelect = () => {

      if (consumeDrag()) return;

      onSelectIndex(index);

    };



    if (!isProgRun) {

      return (

        <SpectacleRunKadrStripRehearsalChip

          key={chipKey}

          projectName={projectName}

          item={item}

          imageHref={imageHref}

          active={active}

          programColor={programColor}

          title={title}

          label={chipLabel}

          chipRef={chipRef}

          tapeIndex={index}

          onSelect={onSelect}

        />

      );

    }



    const summary = buildKadrStripTechSummary({

      item,

      scene,

      lightChannels,

      lightFaders: baseFaders,

      lightPrograms,

      media,

    });



    const chipLightConsole = buildProgRunChipLightConsole(

      kadrForChip,

      lightChannels,

      baseFaders,

      lightPrograms,

    );



    return (

      <SpectacleRunKadrStripProgRunChip

        key={chipKey}

        projectName={projectName}

        item={item}

        imageHref={imageHref}

        summary={summary}

        projectorCtx={projectorCtx}

        active={active}

        programColor={programColor}

        title={title}

        chipNo={chipLabel}

        chipRef={chipRef}

        tapeIndex={index}

        carouselOffset={carouselOffset}

        carouselStacked={carouselStacked}

        notesOverlay={notesOverlay}

        plainCover={plainCover}

        lightConsoleOpen={lightConsoleOpen}

        chipLightConsole={chipLightConsole}

        lightConsoleChannelColumns={lightConsoleChannelColumns}

        sceneSpotlights={scene?.theaterSpotlights ?? []}

        onSelect={onSelect}

      />

    );

  };



  if (tape.length === 0) return null;



  const stripAriaLabel = isFlatTapeLayout ? "Лента картин" : "Лента картин по сценам";



  return (

    <footer
      ref={stripRef}
      className={cn(
        "spectacle-run-kadr-strip",
        isProgRun && "spectacle-run-kadr-strip--prog-run",
        isProgRun && layout === "classic" && "spectacle-run-kadr-strip--prog-run-classic",
        layout === "carousel" && "spectacle-run-kadr-strip--prog-run-carousel",
        isFlowLayout && "spectacle-run-kadr-strip--prog-run-carousel",
        isFlowLayout && "spectacle-run-kadr-strip--prog-run-flow",
        isTrioLayout && "spectacle-run-kadr-strip--prog-run-trio",
        isProgRun && notesOverlay && "spectacle-run-kadr-strip--prog-run-notes-overlay",
        isProgRun && plainCover && "spectacle-run-kadr-strip--prog-run-plain-cover",
      )}
      aria-label={stripAriaLabel}
    >

      <div ref={trackRef} className="spectacle-run-kadr-strip__track">

        {isFlatTapeLayout ? (
          tape.map((item, index) => renderTapeChip(index, item))
        ) : (
          groups.map((group) => (

          <section

            key={group.sceneId}

            className="spectacle-run-kadr-strip__scene"

            aria-label={`Сцена ${group.sceneOrdinal}: ${group.sceneTitle}`}

          >

            <span className="spectacle-run-kadr-strip__scene-number">{group.sceneOrdinal}</span>

            <span className="spectacle-run-kadr-strip__scene-title" title={group.sceneTitle}>

              {group.sceneTitle}

            </span>

            <div className="spectacle-run-kadr-strip__chips">

              {group.items.map(({ tapeIndex: index, item }) => renderTapeChip(index, item))}

            </div>

          </section>

        ))
        )}

      </div>

    </footer>

  );

}


