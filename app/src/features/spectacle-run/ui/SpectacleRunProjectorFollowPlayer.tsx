import cn from "classnames";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  bindRangeFill,
  clampRangeFillPercent,
} from "../../../shared/components/header/header-player-audio";
import { resolveProjectorPreviewSrc } from "../../projector/ui/ProjectorMediaPreview";
import { useSpectacleRunContext } from "../model/spectacle-run-context";

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function isLiveProjectorVideo(
  videoId: number | null | undefined,
  playback: { mode: string; videoId: number | null },
): boolean {
  return (
    videoId != null &&
    videoId > 0 &&
    playback.mode === "video" &&
    Number(playback.videoId) === Number(videoId)
  );
}

type SpectacleRunProjectorFollowPlayerProps = {
  videoId: number;
  variant: "cover" | "field";
  className?: string;
};

export function SpectacleRunProjectorFollowPlayer({
  videoId,
  variant,
  className,
}: SpectacleRunProjectorFollowPlayerProps) {
  const run = useSpectacleRunContext();
  const [src, setSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const blobRef = useRef<string | null>(null);
  const triedRemoteRef = useRef(false);

  const displayPlaying = run.projectorPlayback.playing;
  const displayTime = Math.max(0, run.projectorPlayback.currentTime);
  const displayDuration = Math.max(0, run.projectorPlayback.duration);
  const seekMax = displayDuration > 0 ? displayDuration : 1;
  const fillPercent = clampRangeFillPercent(0, displayDuration, displayTime);
  const playLabel = displayPlaying ? "Пауза" : "Пуск";

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    triedRemoteRef.current = false;

    void resolveProjectorPreviewSrc(run.projectorMediaCtx, "video", videoId, null).then(
      (result) => {
        if (cancelled) {
          if (result.blob && result.src) URL.revokeObjectURL(result.src);
          return;
        }
        if (!result.src) return;
        if (result.blob) blobRef.current = result.src;
        setSrc(result.src);
      },
    );

    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [run.projectorMediaCtx, videoId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const targetTime = run.projectorPlayback.currentTime;
    if (Number.isFinite(targetTime) && Math.abs(video.currentTime - targetTime) > 0.4) {
      video.currentTime = Math.max(0, targetTime);
    }
    if (run.projectorPlayback.playing) {
      if (video.paused) void video.play().catch(() => undefined);
      return;
    }
    if (!video.paused) video.pause();
  }, [run.projectorPlayback.currentTime, run.projectorPlayback.playing, src]);

  const retryRemoteSrc = () => {
    if (triedRemoteRef.current) return;
    triedRemoteRef.current = true;
    void resolveProjectorPreviewSrc(
      run.projectorMediaCtx,
      "video",
      videoId,
      null,
      { preferRemote: true },
    ).then((result) => {
      if (!result.src) return;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
      if (result.blob) blobRef.current = result.src;
      setSrc(result.src);
    });
  };

  const togglePlay = () => {
    run.toggleProjectorVideo(videoId);
  };

  const seekTo = (raw: string) => {
    if (displayDuration <= 0) return;
    const next = Math.max(0, Math.min(displayDuration, Number(raw)));
    run.seekProjectorVideoTime(next);
  };

  const stopChipSelect = (event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      className={cn(
        "spectacle-run-projector-follow",
        variant === "cover" && "spectacle-run-projector-follow--cover",
        variant === "field" && "spectacle-run-projector-follow--field",
        className,
      )}
      onClick={stopChipSelect}
      onKeyDown={stopChipSelect}
    >
      <div className="spectacle-run-projector-follow__stage">
        {src ? (
          <video
            ref={videoRef}
            className="spectacle-run-projector-follow__video"
            src={src}
            playsInline
            muted
            onError={retryRemoteSrc}
          />
        ) : (
          <span className="spectacle-run-projector-follow__blank" />
        )}
      </div>
      <div className="spectacle-run-projector-follow__transport">
        <button
          type="button"
          className="spectacle-run-projector-follow__play"
          data-active={displayPlaying || undefined}
          onClick={togglePlay}
        >
          {playLabel}
        </button>
        <span className="spectacle-run-projector-follow__time">
          {formatPlaybackTime(displayTime)} / {formatPlaybackTime(displayDuration)}
        </span>
        <input
          ref={(el) => bindRangeFill(el, fillPercent)}
          className="spectacle-run-projector-follow__slider"
          type="range"
          min={0}
          max={seekMax}
          step={0.1}
          value={Math.min(displayTime, seekMax)}
          disabled={displayDuration <= 0}
          onChange={(event) => seekTo(event.target.value)}
          aria-label="Прогресс проектора"
        />
      </div>
    </div>
  );
}
