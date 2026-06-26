import cn from "classnames";
import { useEffect, useMemo, useRef } from "react";
import { ProjectorMediaPreview } from "../../projector/ui/ProjectorMediaPreview";
import type { ProjectorMediaContext } from "../../projector/model/projector-media";
import type { NotesRunCardV1 } from "../model/notes-run-types";
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
  cards,
  cardIndex,
  media,
  projectorCtx,
  onSelectIndex,
}: {
  cards: NotesRunCardV1[];
  cardIndex: number;
  media: MediaLookup;
  projectorCtx: ProjectorMediaContext;
  onSelectIndex: (index: number) => void;
}) {
  const active = cards[cardIndex] ?? null;
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
    if (!active?.projectorCue) return null;
    const cue = active.projectorCue;
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
  }, [active, media.holdImages, media.videos]);

  if (cards.length === 0) {
    return (
      <div className="notes-run__empty">
        <p>Карточек пока нет. Создайте вручную или «Из сцен сценария».</p>
      </div>
    );
  }

  return (
    <div className="notes-run__strip-container">
      <div ref={stripRef} className="notes-run__strip" role="tablist" aria-label="Карточки суфлёра">
        {cards.map((card, index) => {
          const activeChip = index === cardIndex;
          const chipRef = activeChip ? activeChipRef : undefined;
          const soundLine = formatSoundLine(card, media);
          const videoLine = formatVideoLine(card, media);
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
                {card.sceneLabel ? (
                  <span className="notes-run__chip-scene">{card.sceneLabel}</span>
                ) : null}
              </header>
              <h3 className="notes-run__chip-title">
                {card.title.trim() || `Картина ${card.cardNo}`}
              </h3>
              {card.commentText ? (
                <p className="notes-run__chip-comment">{card.commentText}</p>
              ) : null}
              <div className="notes-run__chip-light">
                {card.lightLines.length > 0 ? (
                  card.lightLines.map((row, rowIndex) => (
                    <div key={`${card.id}-line-${rowIndex}`} className="notes-run__chip-light-row">
                      {row.label ? <span className="notes-run__chip-light-label">{row.label}</span> : null}
                      {row.value ? <span className="notes-run__chip-light-value">{row.value}</span> : null}
                    </div>
                  ))
                ) : card.lightNotes ? (
                  <p className="notes-run__chip-light-notes">{card.lightNotes}</p>
                ) : (
                  <span className="notes-run__chip-light-placeholder">свет не записан</span>
                )}
              </div>
              {soundLine ? <p className="notes-run__chip-media">{soundLine}</p> : null}
              {videoLine ? <p className="notes-run__chip-media notes-run__chip-media--video">{videoLine}</p> : null}
            </button>
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
