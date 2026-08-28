import { useCallback, useEffect, useMemo, useRef } from "react";

import cn from "classnames";

import { resolveLightFaders } from "../../../shared/components/light-console/light-console-data";
import { findFirstMarkdownImageHref } from "../../../shared/utils/markdownImages";
import { parseKadrTitleFromHeading } from "./create-kadr-from-draft";
import {
  centerKadrStripChip,
  findNearestKadrStripChipIndex,
} from "./kadr-strip-carousel";
import {
  buildProgRunChipLightConsole,
  isCarouselStackedOffset,
  kadrProgramColor,
  resolveTapeItemKadr,
} from "./kadr-strip-chip-utils";
import { buildKadrStripTechSummary } from "./kadr-strip-tech-summary";
import {
  buildSpectacleTapeSceneGroups,
  type SpectacleTapeItem,
} from "./spectacle-kadr-tape";
import type {
  SpectacleRunKadrStripChipModel,
  SpectacleRunKadrStripProps,
} from "./spectacle-run-kadr-strip-types";
import { useKadrStripDragScroll } from "./useKadrStripDragScroll";
import { useProgRunKadrChipHeight } from "./useProgRunKadrChipHeight";

export type { SpectacleRunKadrStripChipModel };

export function useSpectacleRunKadrStrip({
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

  const selectNearestCarouselChip = useCallback(
    (options?: { snapIfSame?: boolean }) => {
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
    },
    [isCarouselLikeLayout, onSelectIndex, tapeIndex],
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

  const buildChipModel = (
    index: number,
    item: SpectacleTapeItem,
  ): SpectacleRunKadrStripChipModel => {
    const active = index === tapeIndex;
    const scene = scenes[item.sceneIndex];
    const programColor = kadrProgramColor(item, scene, lightChannels, baseFaders);
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
      return {
        kind: "rehearsal",
        key: chipKey,
        props: {
          projectName,
          item,
          imageHref,
          active,
          programColor,
          title,
          label: chipLabel,
          chipRef,
          tapeIndex: index,
          onSelect,
        },
      };
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

    return {
      kind: "prog-run",
      key: chipKey,
      props: {
        projectName,
        item,
        imageHref,
        summary,
        projectorCtx,
        active,
        programColor,
        title,
        chipNo: chipLabel,
        chipRef,
        tapeIndex: index,
        carouselOffset,
        carouselStacked,
        notesOverlay,
        plainCover,
        lightConsoleOpen,
        chipLightConsole,
        lightConsoleChannelColumns,
        sceneSpotlights: scene?.theaterSpotlights ?? [],
        onSelect,
      },
    };
  };

  const stripClassName = cn(
    "spectacle-run-kadr-strip",
    isProgRun && "spectacle-run-kadr-strip--prog-run",
    isProgRun && layout === "classic" && "spectacle-run-kadr-strip--prog-run-classic",
    layout === "carousel" && "spectacle-run-kadr-strip--prog-run-carousel",
    isFlowLayout && "spectacle-run-kadr-strip--prog-run-carousel",
    isFlowLayout && "spectacle-run-kadr-strip--prog-run-flow",
    isTrioLayout && "spectacle-run-kadr-strip--prog-run-trio",
    isProgRun && notesOverlay && "spectacle-run-kadr-strip--prog-run-notes-overlay",
    isProgRun && plainCover && "spectacle-run-kadr-strip--prog-run-plain-cover",
  );

  const stripAriaLabel = isFlatTapeLayout ? "Лента картин" : "Лента картин по сценам";
  const isEmpty = tape.length === 0;

  return {
    stripRef,
    trackRef,
    stripClassName,
    stripAriaLabel,
    isEmpty,
    isFlatTapeLayout,
    tape,
    groups,
    buildChipModel,
  };
}
