import cn from "classnames";
import { useEffect, useMemo, useRef } from "react";
import { ProjectorMediaPreview } from "../../projector/ui/ProjectorMediaPreview";
import type { ProjectorMediaContext } from "../../projector/model/projector-media";
import type { NotesRunCardV1, NotesRunSceneGroup } from "../model/notes-run-types";
import "./notes-run.css";

type MediaLookup = {
  playlist: Array<{ id: number; title: string }>;
  sounds: Array<{ id: number; title: string }>;
  videos: Array<{ id: number; title: string }>;
  holdImages: Array<{ id: number; title: string }>;
};

function formatSoundLine(card: NotesRunCardV1, media: MediaLookup): string | null {
  const parts: string[] = [];
  if (card.playTrackId) {
    const title = media.playlist.find((t) => t.id === card.playTrackId)?.title?.trim();
    parts.push(title ? `♪ ${title}` : `♪ трек ${card.playTrackId}`);
  }
  for (const soundId of card.soundIds) {
    const title = media.sounds.find((s) => s.id === soundId)?.title?.trim();
    parts.push(title ? `SFX ${title}` : `SFX ${soundId}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatVideoLine(card: NotesRunCardV1, media: MediaLookup): string | null {
  const cue = card.projectorCue;
  if (!cue) return null;
  if (cue.mode === "hold") {
    const title =
      media.holdImages.find((h) => h.id === cue.holdId)?.title?.trim() ||
      (cue.holdId != null ? `заставка ${cue.holdId}` : "заставка");
    return `▶ ${title}`;
  }
  const title =
    media.videos.find((v) => v.id === cue.videoId)?.title?.trim() || `видео ${cue.videoId}`;
  return `▶ ${title}`;
}

export function NotesRunCardStrip({
  groups,
  cardIndex,
  media,
  projectorCtx,
  onSelectIndex,
  onInitFromScenes,
}: {
  groups: NotesRunSceneGroup[];
  cardIndex: number;
  media: MediaLookup;
  projectorCtx: ProjectorMediaContext;
  onSelectIndex: (index: number) => void;
  onInitFromScenes: () => void;
}) {
  const activeCard =
    groups.flatMap((group) => group.items).find((item) => item.cardIndex === cardIndex)
      ?.card ?? null;
  const stripRef = useRef<HTMLDivElement>(null);
  const activeChipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const chip = activeChipRef.current;
    const track = stripRef.current;
    if (!chip || !track) return;

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
  }, [cardIndex]);

  const activePreview = useMemo(() => {
    if (!activeCard?.projectorCue) return null;
    const cue = activeCard.projectorCue;
    if (cue.mode === "video") {
      return {
        mode: "video" as const,
        videoId: cue.videoId,
        holdId: null as number | null,
        title:
          media.videos.find((v) => v.id === cue.videoId)?.title?.trim() ||
          `Видео ${cue.videoId}`,
      };
    }
    return {
      mode: "hold" as const,
      videoId: null as number | null,
      holdId: cue.holdId ?? null,
      title:
        media.holdImages.find((h) => h.id === cue.holdId)?.title?.trim() ||
        (cue.holdId != null ? `Заставка ${cue.holdId}` : "Заставка"),
    };
  }, [activeCard, media.holdImages, media.videos]);

  if (groups.length === 0) {
    return (
      <div className="notes-run__empty">
        <p>
          Карточек пока нет. Создайте программу вручную или по сценам сценария —
          как прогон, только текст пишете сами.
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

  return (
    <div className="notes-run__strip-container">
      <div
        ref={stripRef}
        className="notes-run__strip"
        role="tablist"
        aria-label="Карточки суфлера по сценам"
      >
        {groups.map((group) => {
          const groupKey = group.sceneId ?? `label:${group.sceneTitle}`;
          const sceneHeading =
            group.sceneOrdinal > 0
              ? `С${group.sceneOrdinal} · ${group.sceneTitle}`
              : group.sceneTitle;
          return (
            <section
              key={groupKey}
              className="notes-run__scene-group"
              aria-label={sceneHeading}
            >
              <header className="notes-run__scene-group-header">
                {group.sceneOrdinal > 0 ? (
                  <span className="notes-run__scene-group-number">{group.sceneOrdinal}</span>
                ) : null}
                <span className="notes-run__scene-group-title" title={group.sceneTitle}>
                  {group.sceneTitle}
                </span>
              </header>
              <div className="notes-run__scene-group-chips">
                {group.items.map(({ card, cardIndex: index }) => {
                  const activeChip = index === cardIndex;
                  const chipRef = activeChip ? activeChipRef : undefined;
                  const soundLine = formatSoundLine(card, media);
                  const videoLine = formatVideoLine(card, media);
                  const chipTitle = card.title.trim() || `Карточка ${card.cardNo}`;
                  return (
                    <button
                      key={card.id}
                      ref={chipRef}
                      type="button"
                      role="tab"
                      aria-selected={activeChip}
                      className={cn("notes-run__chip", activeChip && "notes-run__chip--active")}
                      onClick={() => onSelectIndex(index)}
                    >
                      <header className="notes-run__chip-header">
                        <span className="notes-run__chip-number">#{card.cardNo}</span>
                      </header>
                      <h3 className="notes-run__chip-title">{chipTitle}</h3>
                      {card.commentText ? (
                        <p className="notes-run__chip-comment">{card.commentText}</p>
                      ) : null}
                      <div className="notes-run__chip-light">
                        {card.lightLines.length > 0 ? (
                          card.lightLines.map((row, rowIndex) => (
                            <div
                              key={`${card.id}-line-${rowIndex}`}
                              className="notes-run__chip-light-row"
                            >
                              {row.label ? (
                                <span className="notes-run__chip-light-label">{row.label}</span>
                              ) : null}
                              {row.value ? (
                                <span className="notes-run__chip-light-value">{row.value}</span>
                              ) : null}
                            </div>
                          ))
                        ) : card.lightNotes ? (
                          <p className="notes-run__chip-light-notes">{card.lightNotes}</p>
                        ) : (
                          <span className="notes-run__chip-light-placeholder">свет не записан</span>
                        )}
                      </div>
                      {soundLine ? <p className="notes-run__chip-media">{soundLine}</p> : null}
                      {videoLine ? (
                        <p className="notes-run__chip-media notes-run__chip-media--video">
                          {videoLine}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {activePreview ? (
        <ProjectorMediaPreview
          ctx={projectorCtx}
          mode={activePreview.mode}
          videoId={activePreview.videoId}
          holdId={activePreview.holdId}
          title={activePreview.title}
          className="notes-run__projector-preview"
        />
      ) : null}
    </div>
  );
}
