import cn from "classnames";
import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent, type Ref } from "react";
import {
  resolveDefaultHoldId,
  type ProjectorMediaContext,
} from "../../projector/model/projector-media";
import { ProjectorMediaPreview } from "../../projector/ui/ProjectorMediaPreview";
import {
  centerKadrStripChip,
  findNearestKadrStripChipIndex,
} from "../../spectacle-run/model/kadr-strip-carousel";
import type { ProgRunKadrStripLayout } from "../../spectacle-run/model/prog-run-prefs-storage";
import { useKadrStripDragScroll } from "../../spectacle-run/model/useKadrStripDragScroll";
import { useProgRunKadrChipHeight } from "../../spectacle-run/model/useProgRunKadrChipHeight";
import type { NotesRunCardV1, NotesRunSceneGroup } from "../model/notes-run-types";
import "../../spectacle-run/ui/style.css";
import "./notes-run.css";
type MediaLookup = {
  playlist: Array<{ id: number; title: string }>;
  sounds: Array<{ id: number; title: string }>;
  videos: Array<{ id: number; title: string }>;
  holdImages: Array<{ id: number; title: string }>;
};

type NotesRunLightRow = {
  label: string;
  value: string;
};

function formatTrackCoverValue(card: NotesRunCardV1, media: MediaLookup): string | null {
  if (!card.playTrackId) return null;
  const title = media.playlist.find((track) => track.id === card.playTrackId)?.title?.trim();
  if (title) return `«${title}»`;
  return `трек ${card.playTrackId}`;
}

function formatSoundBodyValue(card: NotesRunCardV1, media: MediaLookup): string | null {
  if (card.soundIds.length === 0) return null;
  const parts = card.soundIds.map((soundId) => {
    const title = media.sounds.find((sound) => sound.id === soundId)?.title?.trim();
    return title || `SFX ${soundId}`;
  });
  return parts.join(" · ");
}

function pickCoverLightRow(card: NotesRunCardV1): NotesRunLightRow | null {
  const lightByLabel = card.lightLines.find(
    (row) => row.label.trim().toLowerCase() === "свет" && row.value.trim(),
  );
  if (lightByLabel) {
    return { label: "Свет", value: lightByLabel.value.trim() };
  }

  const firstFilled = card.lightLines.find((row) => row.value.trim());
  if (firstFilled) {
    const label = firstFilled.label.trim() || "Свет";
    return { label, value: firstFilled.value.trim() };
  }

  const lightNotes = card.lightNotes.trim();
  if (lightNotes) {
    return { label: "Свет", value: lightNotes };
  }

  return null;
}

function bodyLightRows(card: NotesRunCardV1, coverLight: NotesRunLightRow | null): NotesRunLightRow[] {
  const coverValue = coverLight?.value ?? "";
  const coverLabel = coverLight?.label ?? "";

  return card.lightLines
    .filter((row) => row.value.trim())
    .filter((row) => {
      if (!coverLight) return true;
      const sameLabel = row.label.trim() === coverLabel || (!row.label.trim() && coverLabel === "Свет");
      const sameValue = row.value.trim() === coverValue;
      return !(sameLabel && sameValue);
    })
    .map((row) => ({
      label: row.label.trim() || "Свет",
      value: row.value.trim(),
    }));
}

function resolveProjectorPreview(
  card: NotesRunCardV1,
  media: MediaLookup,
): {
  mode: "video" | "hold";
  videoId: number | null;
  holdId: number | null;
  title: string;
} | null {
  const cue = card.projectorCue;
  if (!cue) return null;

  if (cue.mode === "hold") {
    const title =
      media.holdImages.find((hold) => hold.id === cue.holdId)?.title?.trim() ||
      (cue.holdId != null ? `Заставка ${cue.holdId}` : "Заставка");
    return {
      mode: "hold",
      videoId: null,
      holdId: cue.holdId ?? null,
      title,
    };
  }

  const title =
    media.videos.find((video) => video.id === cue.videoId)?.title?.trim() ||
    `Видео ${cue.videoId}`;
  return {
    mode: "video",
    videoId: cue.videoId ?? null,
    holdId: null,
    title,
  };
}

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

function NotesRunKadrChip({
  card,
  active,
  media,
  projectorCtx,
  chipRef,
  tapeIndex,
  carouselOffset,
  carouselStacked,
  notesOverlay,
  plainCover,
  onSelect,
}: {
  card: NotesRunCardV1;
  active: boolean;
  media: MediaLookup;
  projectorCtx: ProjectorMediaContext;
  chipRef?: Ref<HTMLDivElement>;
  tapeIndex: number;
  carouselOffset: number;
  carouselStacked: boolean;
  notesOverlay: boolean;
  plainCover: boolean;
  onSelect: () => void;
}) {
  const chipTitle = card.title.trim() || `Картина ${card.cardNo}`;
  const chipNo = `K${card.cardNo}`;
  const trackCoverValue = formatTrackCoverValue(card, media);
  const coverLightRow = pickCoverLightRow(card);
  const extraLightRows = bodyLightRows(card, notesOverlay ? coverLightRow : null);
  const soundBodyValue = formatSoundBodyValue(card, media);
  const commentText = card.commentText.trim();
  const transitionText = card.transitionText.trim();
  const projectorPreview = plainCover ? null : resolveProjectorPreview(card, media);
  const showProjectorCover = !plainCover && projectorPreview != null;
  const showPlainCover = plainCover || !showProjectorCover;
  const showCoverFields =
    notesOverlay && Boolean(trackCoverValue || coverLightRow);
  const bodyTrackRow = !notesOverlay && trackCoverValue ? trackCoverValue : null;
  const bodyCoverLightRow = !notesOverlay ? coverLightRow : null;
  const hasBodyFields =
    extraLightRows.length > 0 ||
    Boolean(bodyTrackRow) ||
    Boolean(bodyCoverLightRow) ||
    Boolean(soundBodyValue) ||
    Boolean(commentText);
  const hasTransition = Boolean(transitionText);

  const coverHoldId =
    projectorPreview?.mode === "hold"
      ? projectorPreview.holdId ?? resolveDefaultHoldId(projectorCtx)
      : null;

  const handleChipKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  };

  return (
    <div
      ref={chipRef}
      role="button"
      tabIndex={0}
      className="spectacle-run-kadr-strip__chip"
      data-active={active ? "true" : undefined}
      data-tape-index={tapeIndex}
      data-carousel-offset={carouselOffset}
      data-carousel-stack={carouselStacked ? "true" : undefined}
      data-has-thumb={showProjectorCover ? "true" : undefined}
      data-plain-cover={showPlainCover ? "true" : undefined}
      title={chipTitle}
      onClick={onSelect}
      onKeyDown={handleChipKeyDown}
    >
      <span className="spectacle-run-kadr-strip__chip-layout spectacle-run-kadr-strip__chip-layout--stack">
        <span
          className={cn(
            "spectacle-run-kadr-strip__chip-cover",
            showPlainCover && "spectacle-run-kadr-strip__chip-cover--plain",
            showProjectorCover && "spectacle-run-kadr-strip__chip-cover--thumb",
          )}
          aria-hidden
        >
          {showProjectorCover && projectorPreview ? (
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
            <span className="spectacle-run-kadr-strip__chip-title" title={chipTitle}>
              {chipTitle}
            </span>
          </span>

          {showCoverFields ? (
            <span className="spectacle-run-kadr-strip__chip-cover-fields">
              {trackCoverValue ? (
                <span className="spectacle-run-kadr-strip__chip-cover-fields-zone spectacle-run-kadr-strip__chip-cover-fields-zone--top">
                  <span className="spectacle-run-kadr-strip__chip-cover-field spectacle-run-kadr-strip__chip-cover-field--track">
                    <span className="spectacle-run-kadr-strip__chip-cover-field-label">Трек</span>
                    <span
                      className="spectacle-run-kadr-strip__chip-cover-field-value"
                      title={trackCoverValue}
                    >
                      {trackCoverValue}
                    </span>
                  </span>
                </span>
              ) : null}
              {coverLightRow ? (
                <span className="spectacle-run-kadr-strip__chip-cover-fields-zone spectacle-run-kadr-strip__chip-cover-fields-zone--bottom">
                  <span className="spectacle-run-kadr-strip__chip-cover-field">
                    <span className="spectacle-run-kadr-strip__chip-cover-field-label">
                      {coverLightRow.label}
                    </span>
                    <span
                      className="spectacle-run-kadr-strip__chip-cover-field-value"
                      title={coverLightRow.value}
                    >
                      {coverLightRow.value}
                    </span>
                  </span>
                </span>
              ) : null}
            </span>
          ) : null}
        </span>

        <span
          className={cn(
            "spectacle-run-kadr-strip__chip-body",
            hasTransition && "spectacle-run-kadr-strip__chip-body--with-transition",
          )}
        >
          {hasBodyFields ? (
            <span className="spectacle-run-kadr-strip__chip-fields">
              {bodyTrackRow ? (
                <span className="spectacle-run-kadr-strip__chip-field spectacle-run-kadr-strip__chip-field--track">
                  <span className="spectacle-run-kadr-strip__chip-field-label">Трек</span>
                  <span
                    className="spectacle-run-kadr-strip__chip-field-value"
                    title={bodyTrackRow}
                  >
                    {bodyTrackRow}
                  </span>
                </span>
              ) : null}

              {bodyCoverLightRow ? (
                <span className="spectacle-run-kadr-strip__chip-field">
                  <span className="spectacle-run-kadr-strip__chip-field-label">
                    {bodyCoverLightRow.label}
                  </span>
                  <span
                    className="spectacle-run-kadr-strip__chip-field-value"
                    title={bodyCoverLightRow.value}
                  >
                    {bodyCoverLightRow.value}
                  </span>
                </span>
              ) : null}

              {extraLightRows.length > 0 ? (
                <span className="spectacle-run-kadr-strip__chip-fields-live">
                  {extraLightRows.map((row) => (
                    <span key={`${row.label}-${row.value}`} className="spectacle-run-kadr-strip__chip-field">
                      <span className="spectacle-run-kadr-strip__chip-field-label">{row.label}</span>
                      <span
                        className="spectacle-run-kadr-strip__chip-field-value"
                        title={row.value}
                      >
                        {row.value}
                      </span>
                    </span>
                  ))}
                </span>
              ) : null}

              {soundBodyValue ? (
                <span className="spectacle-run-kadr-strip__chip-field">
                  <span className="spectacle-run-kadr-strip__chip-field-label">Звук</span>
                  <span
                    className="spectacle-run-kadr-strip__chip-field-value"
                    title={soundBodyValue}
                  >
                    {soundBodyValue}
                  </span>
                </span>
              ) : null}

              {commentText ? (
                <span className="spectacle-run-kadr-strip__chip-fields-notes">
                  <span className="spectacle-run-kadr-strip__chip-field">
                    <span className="spectacle-run-kadr-strip__chip-field-label">Комментарий</span>
                    <span
                      className={cn(
                        "spectacle-run-kadr-strip__chip-field-value",
                        "spectacle-run-kadr-strip__chip-field-value--multiline",
                      )}
                      title={commentText}
                    >
                      {commentText}
                    </span>
                  </span>
                </span>
              ) : null}
            </span>
          ) : (
            <span className="spectacle-run-kadr-strip__chip-empty">—</span>
          )}

          {hasTransition ? (
            <span className="spectacle-run-kadr-strip__chip-transition">
              <span
                className={cn(
                  "spectacle-run-kadr-strip__chip-transition-value",
                  transitionText.includes("\n") &&
                    "spectacle-run-kadr-strip__chip-transition-value--multiline",
                )}
                title={transitionText}
              >
                {transitionText}
              </span>
            </span>
          ) : null}
        </span>
      </span>
    </div>
  );
}

export function NotesRunCardStrip({
  groups,
  cardIndex,
  layout,
  notesOverlay,
  plainCover,
  lightConsoleOpen,
  media,
  projectorCtx,
  onSelectIndex,
  onInitFromScenes,
}: {
  groups: NotesRunSceneGroup[];
  cardIndex: number;
  layout: ProgRunKadrStripLayout;
  notesOverlay: boolean;
  plainCover: boolean;
  lightConsoleOpen: boolean;
  media: MediaLookup;
  projectorCtx: ProjectorMediaContext;
  onSelectIndex: (index: number) => void;
  onInitFromScenes: () => void;
}) {
  const stripRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeChipRef = useRef<HTMLDivElement>(null);
  const carouselIgnoreUntilRef = useRef(0);

  const isFlowLayout = layout === "flow";
  const isTrioLayout = layout === "trio";
  const isFlatTapeLayout = isFlowLayout || isTrioLayout;
  const isCarouselLikeLayout =
    layout === "carousel" || layout === "flow" || layout === "trio";

  const flatItems = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups],
  );

  const activeSceneId = flatItems[cardIndex]?.card.sceneId ?? null;

  const chipHeightKey = useMemo(
    () =>
      [
        layout,
        flatItems
          .map(({ card }) => `${card.id}:${card.cardNo}:${card.commentText.length}`)
          .join("|"),
      ].join("|"),
    [flatItems, layout, lightConsoleOpen, notesOverlay, plainCover],
  );

  useProgRunKadrChipHeight(true, stripRef, chipHeightKey);

  const selectNearestCarouselChip = useCallback(
    (options?: { snapIfSame?: boolean }) => {
      if (!isCarouselLikeLayout) return;
      if (Date.now() < carouselIgnoreUntilRef.current) return;
      const track = trackRef.current;
      if (!track || track.dataset.dragging === "true") return;
      const nearestIndex = findNearestKadrStripChipIndex(track);
      if (nearestIndex != null && nearestIndex !== cardIndex) {
        onSelectIndex(nearestIndex);
        return;
      }
      if (!options?.snapIfSame) return;
      const chip = activeChipRef.current;
      if (!chip) return;
      carouselIgnoreUntilRef.current = Date.now() + 450;
      centerKadrStripChip(track, chip, "smooth");
    },
    [cardIndex, isCarouselLikeLayout, onSelectIndex],
  );

  const { consumeDrag } = useKadrStripDragScroll(trackRef, {
    onDragEnd: isCarouselLikeLayout
      ? () => {
          window.requestAnimationFrame(() => {
            selectNearestCarouselChip({ snapIfSame: true });
          });
        }
      : undefined,
  });

  useEffect(() => {
    const chip = activeChipRef.current;
    const track = trackRef.current;
    if (!chip || !track) return;

    if (isCarouselLikeLayout) {
      carouselIgnoreUntilRef.current = Date.now() + 520;
      track.scrollLeft = 0;
      const snapActiveChip = () => {
        centerKadrStripChip(track, chip, "instant");
      };
      snapActiveChip();
      requestAnimationFrame(() => {
        snapActiveChip();
        requestAnimationFrame(snapActiveChip);
      });
      return;
    }

    const chipLeft = chip.offsetLeft;
    const chipRight = chipLeft + chip.offsetWidth;
    const viewLeft = track.scrollLeft;
    const viewRight = viewLeft + track.clientWidth;
    const edgePadding = 8;
    const chipOutsideView =
      chipLeft < viewLeft + edgePadding || chipRight > viewRight - edgePadding;

    if (chipOutsideView) {
      chip.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });
    }
  }, [cardIndex, isCarouselLikeLayout, layout]);

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

  const renderChip = (index: number, card: NotesRunCardV1) => {
    const active = index === cardIndex;
    const carouselOffset = index - cardIndex;
    const stackMode = isTrioLayout ? "trio" : isFlowLayout ? "flow" : "carousel";
    const carouselStacked =
      isCarouselLikeLayout &&
      isCarouselStackedOffset(carouselOffset, stackMode) &&
      (isFlatTapeLayout || card.sceneId === activeSceneId);

    const onSelect = () => {
      if (consumeDrag()) return;
      onSelectIndex(index);
    };

    return (
      <NotesRunKadrChip
        key={card.id}
        card={card}
        active={active}
        media={media}
        projectorCtx={projectorCtx}
        chipRef={active ? activeChipRef : undefined}
        tapeIndex={index}
        carouselOffset={carouselOffset}
        carouselStacked={carouselStacked}
        notesOverlay={notesOverlay}
        plainCover={plainCover}
        onSelect={onSelect}
      />
    );
  };

  if (groups.length === 0) {
    return (
      <div className="notes-run__empty">
        <p>
          Карточек пока нет. Создайте программу вручную или по сценам сценария —
          текст и свет заполняете сами.
        </p>
        <button
          type="button"
          className="notes-run__empty-action"
          onClick={onInitFromScenes}
        >
          Из сцен сценария
        </button>
      </div>
    );
  }

  const stripAriaLabel = isFlatTapeLayout ? "Карточки суфлера" : "Карточки суфлера по сценам";

  return (
    <footer
      ref={stripRef}
      className={cn(
        "spectacle-run-kadr-strip",
        "spectacle-run-kadr-strip--prog-run",
        layout === "classic" && "spectacle-run-kadr-strip--prog-run-classic",
        layout === "carousel" && "spectacle-run-kadr-strip--prog-run-carousel",
        isFlowLayout && "spectacle-run-kadr-strip--prog-run-carousel",
        isFlowLayout && "spectacle-run-kadr-strip--prog-run-flow",
        isTrioLayout && "spectacle-run-kadr-strip--prog-run-trio",
        notesOverlay && "spectacle-run-kadr-strip--prog-run-notes-overlay",
        plainCover && "spectacle-run-kadr-strip--prog-run-plain-cover",
        "spectacle-run-kadr-strip--notes-run",
      )}
      aria-label={stripAriaLabel}
    >
      <div
        ref={trackRef}
        className="spectacle-run-kadr-strip__track"
        role="tablist"
        aria-label={stripAriaLabel}
      >
        {isFlatTapeLayout
          ? flatItems.map(({ card }, index) => renderChip(index, card))
          : groups.map((group) => {
              const groupKey = group.sceneId ?? `label:${group.sceneTitle}`;
              const sceneOrdinalLabel =
                group.sceneOrdinal > 0 ? String(group.sceneOrdinal) : "—";
              const sceneTitle = group.sceneTitle.trim() || "Без сцены";

              return (
                <section
                  key={groupKey}
                  className="spectacle-run-kadr-strip__scene"
                  aria-label={
                    group.sceneOrdinal > 0
                      ? `С${group.sceneOrdinal} · ${sceneTitle}`
                      : sceneTitle
                  }
                >
                  <div className="spectacle-run-kadr-strip__chips">
                    {group.items.map(({ card, cardIndex: index }) => renderChip(index, card))}
                  </div>
                  <span className="spectacle-run-kadr-strip__scene-number">{sceneOrdinalLabel}</span>
                  <span className="spectacle-run-kadr-strip__scene-title" title={sceneTitle}>
                    {sceneTitle}
                  </span>
                </section>
              );
            })}
      </div>
    </footer>
  );
}
