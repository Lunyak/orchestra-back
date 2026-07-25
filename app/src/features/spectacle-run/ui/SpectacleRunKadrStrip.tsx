import { useEffect, useMemo, useRef, type CSSProperties, type Ref } from "react";

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

import { resolveLightFaders } from "../../../shared/components/light-console/light-console-data";

import { resolveLightColor } from "../../../shared/components/show-script/utils/lightTokens";

import type { ScriptScene } from "../../../shared/types/script";

import {

  buildSpectacleTapeSceneGroups,

  type SpectacleTapeItem,

} from "../model/spectacle-kadr-tape";

import { parseKadrTitleFromHeading } from "../model/create-kadr-from-draft";
import { findFirstMarkdownImageHref } from "../../../shared/utils/markdownImages";

import { formatKadrRunLabelText } from "../model/kadr-section-labels";

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

export type SpectacleRunKadrStripVariant = "rehearsal" | "prog-run";



export type SpectacleRunKadrStripProps = {

  variant?: SpectacleRunKadrStripVariant;

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



type KadrStripChipBaseProps = {

  projectName: string;

  item: SpectacleTapeItem;

  imageHref: string | null;

  active: boolean;

  programColor: string | null;

  title: string;

  onSelect: () => void;

  chipRef?: Ref<HTMLButtonElement>;

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



function SpectacleRunKadrStripChipFieldValue({

  row,

  projectorCtx,

}: {

  row: KadrStripTechRow;

  projectorCtx: ProjectorMediaContext | null;

}) {

  const preview = row.projectorPreview;

  const hasPreview = row.label === "Видео" && preview != null && projectorCtx != null;



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



  return (

    <span className="spectacle-run-kadr-strip__chip-field-media">

      <ProjectorMediaPreview

        ctx={projectorCtx}

        mode={preview.mode}

        videoId={preview.videoId}

        holdId={holdId}

        title={preview.title}

        className="spectacle-run-kadr-strip__chip-field-preview"

        fallbackClassName="spectacle-run-kadr-strip__chip-field-preview-fallback"

      />

      <span className="spectacle-run-kadr-strip__chip-field-value" title={row.value}>

        {row.value}

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

}: KadrStripChipBaseProps & {

  summary: KadrStripTechSummary;

  projectorCtx: ProjectorMediaContext | null;

  chipNo: string;

}) {

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

      data-placeholder={item.isPlaceholder ? "true" : undefined}

      data-has-thumb={hasThumb ? "true" : undefined}

      data-has-fallback-color={fallbackColor ? "true" : undefined}

      data-blackout={summary.blackout ? "true" : undefined}

      style={chipAccentStyle}

      title={title}

      onClick={onSelect}

    >

      <span className="spectacle-run-kadr-strip__chip-layout spectacle-run-kadr-strip__chip-layout--stack">

        <span className="spectacle-run-kadr-strip__chip-header">

          <span className="spectacle-run-kadr-strip__chip-number">{chipNo}</span>

          {summary.headingTitle ? (

            <span className="spectacle-run-kadr-strip__chip-title" title={summary.headingTitle}>

              {summary.headingTitle}

            </span>

          ) : null}

          {summary.blackout ? (

            <span className="spectacle-run-kadr-strip__chip-badge">Блекаут</span>

          ) : null}

        </span>

        <span

          className={cn(

            "spectacle-run-kadr-strip__chip-cover",

            hasThumb && "spectacle-run-kadr-strip__chip-cover--thumb",

          )}

          aria-hidden

        >

          {hasThumb ? (

            <img

              src={imageSrc ?? undefined}

              alt=""

              className="spectacle-run-kadr-strip__chip-cover-img"

              onError={onImageError}

            />

          ) : null}

          {summary.cornerLabels.length > 0 ? (

            <span className="spectacle-run-kadr-strip__chip-corner-labels">

              {summary.cornerLabels.map((label) => (

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

              ))}

            </span>

          ) : null}

        </span>

        <span className="spectacle-run-kadr-strip__chip-body">

          {summary.rows.length > 0 ? (

            <span className="spectacle-run-kadr-strip__chip-fields">

              {summary.rows.map((row) => (

                <span key={row.label} className="spectacle-run-kadr-strip__chip-field">

                  <span className="spectacle-run-kadr-strip__chip-field-label">{row.label}</span>

                  <SpectacleRunKadrStripChipFieldValue row={row} projectorCtx={projectorCtx} />

                </span>

              ))}

            </span>

          ) : item.isPlaceholder ? (

            <span className="spectacle-run-kadr-strip__chip-empty">нет картин в сцене</span>

          ) : null}

        </span>

      </span>

    </button>

  );

}



export function SpectacleRunKadrStrip({

  variant = "rehearsal",

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

  const activeChipRef = useRef<HTMLButtonElement | null>(null);

  const { consumeDrag } = useKadrStripDragScroll(trackRef);

  const chipHeightKey = useMemo(
    () =>
      tape
        .map((item) => {
          const scene = scenes[item.sceneIndex];
          const markdownLen = String(scene?.markdown ?? "").length;
          return `${item.kadrId ?? "ph"}:${item.kadrNo}:${markdownLen}`;
        })
        .join("|"),
    [scenes, tape],
  );

  useProgRunKadrChipHeight(isProgRun, stripRef, chipHeightKey);



  useEffect(() => {

    const chip = activeChipRef.current;

    const track = trackRef.current;

    if (!chip || !track) return;

    const chipLeft = chip.offsetLeft;

    const chipRight = chipLeft + chip.offsetWidth;

    const viewLeft = track.scrollLeft;

    const viewRight = viewLeft + track.clientWidth;

    if (chipLeft < viewLeft + 8 || chipRight > viewRight - 8) {

      chip.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });

    }

  }, [tapeIndex]);



  if (tape.length === 0) return null;



  return (

    <footer
      ref={stripRef}
      className={cn("spectacle-run-kadr-strip", isProgRun && "spectacle-run-kadr-strip--prog-run")}
      aria-label="Лента картин по сценам"
    >

      <div ref={trackRef} className="spectacle-run-kadr-strip__track">

        {groups.map((group) => (

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

              {group.items.map(({ tapeIndex: index, item }) => {

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

                const kadrForImage =
                  scene && item.kadrId
                    ? findKadrById(readSceneLightKadrs(scene), item.kadrId)
                    : undefined;

                const imageHref = item.isPlaceholder
                  ? null
                  : findFirstMarkdownImageHref(kadrForImage?.imageMarkdown ?? "");

                const chipKey = `${item.sceneId}-${item.kadrId ?? "ph"}-${item.kadrNo}-${index}`;

                const chipRef = active ? activeChipRef : undefined;

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

                    onSelect={onSelect}

                  />

                );

              })}

            </div>

          </section>

        ))}

      </div>

    </footer>

  );

}


