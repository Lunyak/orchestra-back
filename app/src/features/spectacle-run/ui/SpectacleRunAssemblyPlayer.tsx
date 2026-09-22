import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import { CustomSelect } from "../../../shared/core/custom-select/CustomSelect";
import {
  bindRangeFill,
  clampRangeFillPercent,
} from "../../../shared/components/header/header-player-audio";
import { resolveProjectorPreviewSrc } from "../../projector/ui/ProjectorMediaPreview";
import { useSpectacleRunContext } from "../model/spectacle-run-context";
import {
  persistAssemblyPlayerExpanded,
  readAssemblyPlayerExpanded,
} from "../model/assembly-player-prefs";

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function SpectacleRunAssemblyPlayer() {
  const run = useSpectacleRunContext();
  const videos = run.videos;
  const videoOptions = videos.map((video) => ({
    value: String(video.id),
    label: video.title?.trim() || `Видео ${video.id}`,
  }));

  const [expanded, setExpanded] = useState(() =>
    readAssemblyPlayerExpanded(run.projectName),
  );
  const [selectedId, setSelectedId] = useState<number | null>(
    videos[0] ? Number(videos[0].id) : null,
  );
  const [src, setSrc] = useState<string | null>(null);
  const [srcFailed, setSrcFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pendingLinkId, setPendingLinkId] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const blobRef = useRef<string | null>(null);
  const triedRemoteRef = useRef(false);

  const selectedVideo =
    selectedId != null
      ? videos.find((video) => Number(video.id) === selectedId) ?? null
      : null;
  const selectedLabel =
    selectedVideo?.title?.trim() ||
    (selectedId != null ? `Видео ${selectedId}` : "Нет видео");
  const hasVideos = videos.length > 0;
  const onProjector =
    selectedId != null &&
    run.isProjectorOpen &&
    run.projectorPlayback.mode === "video" &&
    Number(run.projectorPlayback.videoId) === selectedId;
  const linking = pendingLinkId != null && pendingLinkId === selectedId && !onProjector;
  const followProjector = onProjector || linking;
  const displayPlaying = onProjector ? run.projectorPlayback.playing : playing;
  const displayTime = onProjector ? run.projectorPlayback.currentTime : currentTime;
  const displayDuration =
    onProjector && run.projectorPlayback.duration > 0
      ? run.projectorPlayback.duration
      : duration;
  const seekMax = displayDuration > 0 ? displayDuration : 1;
  const fillPercent = clampRangeFillPercent(0, displayDuration, displayTime);
  const playLabel = displayPlaying ? "Пауза" : "Пуск";
  const outputLabel = onProjector ? "На экране" : "На проектор";

  useEffect(() => {
    if (selectedId != null && videos.some((video) => Number(video.id) === selectedId)) {
      return;
    }
    setPendingLinkId(null);
    setSelectedId(videos[0] ? Number(videos[0].id) : null);
  }, [selectedId, videos]);

  useEffect(() => {
    if (onProjector && pendingLinkId != null) setPendingLinkId(null);
  }, [onProjector, pendingLinkId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = followProjector;
    if (!onProjector) return;
    const targetTime = run.projectorPlayback.currentTime;
    if (Number.isFinite(targetTime) && Math.abs(video.currentTime - targetTime) > 0.4) {
      video.currentTime = Math.max(0, targetTime);
    }
    if (run.projectorPlayback.playing) {
      if (video.paused) void video.play().catch(() => undefined);
      return;
    }
    if (!video.paused) video.pause();
  }, [
    followProjector,
    onProjector,
    run.projectorPlayback.currentTime,
    run.projectorPlayback.playing,
  ]);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setSrcFailed(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    triedRemoteRef.current = false;

    if (selectedId == null) return undefined;

    void resolveProjectorPreviewSrc(run.projectorMediaCtx, "video", selectedId, null).then(
      (result) => {
        if (cancelled) {
          if (result.blob && result.src) URL.revokeObjectURL(result.src);
          return;
        }
        if (!result.src) {
          setSrcFailed(true);
          return;
        }
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
  }, [run.projectorMediaCtx, selectedId]);

  const retryRemoteSrc = () => {
    if (selectedId == null || triedRemoteRef.current) {
      setSrcFailed(true);
      return;
    }
    triedRemoteRef.current = true;
    void resolveProjectorPreviewSrc(
      run.projectorMediaCtx,
      "video",
      selectedId,
      null,
      { preferRemote: true },
    ).then((result) => {
      if (!result.src) {
        setSrcFailed(true);
        return;
      }
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
      if (result.blob) blobRef.current = result.src;
      setSrcFailed(false);
      setSrc(result.src);
    });
  };

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    persistAssemblyPlayerExpanded(run.projectName, next);
  };

  const togglePlay = () => {
    if (selectedId == null) return;
    if (onProjector) {
      run.toggleProjectorVideo(selectedId);
      return;
    }
    const video = videoRef.current;
    if (!video || !src) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
      return;
    }
    video.pause();
  };

  const seekTo = (raw: string) => {
    const next = Math.max(0, Math.min(displayDuration, Number(raw)));
    if (onProjector) {
      run.seekProjectorVideoTime(next);
      return;
    }
    const video = videoRef.current;
    if (!video || displayDuration <= 0) return;
    video.currentTime = next;
    setCurrentTime(next);
  };

  const sendToProjector = () => {
    if (selectedId == null) return;
    if (onProjector) {
      void run.ensureProjectorOpen();
      return;
    }
    setPendingLinkId(selectedId);
    void run.playProjectorVideo(selectedId, {
      startTime: displayTime,
      paused: !displayPlaying,
    }).then((ok) => {
      if (!ok) setPendingLinkId(null);
    });
  };

  return (
    <section
      className={cn(
        "spectacle-run-assembly-player",
        !expanded && "spectacle-run-assembly-player--collapsed",
      )}
      aria-label="Плеер сборки"
    >
      <div className="spectacle-run-assembly-player__bar">
        <span className="spectacle-run-assembly-player__title">Видео</span>
        <button
          type="button"
          className="spectacle-run-assembly-player__btn spectacle-run-assembly-player__btn--collapse"
          aria-expanded={expanded}
          onClick={toggleExpanded}
        >
          {expanded ? "Свернуть" : "Развернуть"}
        </button>
        <div className="spectacle-run-assembly-player__select">
          <CustomSelect
            value={selectedId != null ? String(selectedId) : ""}
            options={videoOptions}
            onChange={(next) => {
              setPendingLinkId(null);
              setSelectedId(Number(next));
            }}
            placeholder="Выберите видео"
            noOptionsLabel="Нет видео"
            disabled={!hasVideos}
            aria-label="Ролик для плеера сборки"
          />
        </div>
        <button
          type="button"
          className="spectacle-run-assembly-player__btn spectacle-run-assembly-player__btn--play"
          data-active={displayPlaying || undefined}
          disabled={!onProjector && !src}
          onClick={togglePlay}
        >
          {playLabel}
        </button>
        <button
          type="button"
          className="spectacle-run-assembly-player__btn spectacle-run-assembly-player__btn--output"
          data-active={onProjector || linking || undefined}
          disabled={selectedId == null}
          onClick={sendToProjector}
        >
          {outputLabel}
        </button>
      </div>

      <div className="spectacle-run-assembly-player__body">
        <div className="spectacle-run-assembly-player__stage">
          {src ? (
            <video
              ref={videoRef}
              className="spectacle-run-assembly-player__video"
              src={src}
              playsInline
              muted={followProjector}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(event) => {
                if (onProjector) return;
                setCurrentTime(event.currentTarget.currentTime);
              }}
              onLoadedMetadata={(event) => {
                const nextDuration = event.currentTarget.duration;
                setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
              }}
              onEnded={() => {
                setPlaying(false);
                setCurrentTime(duration);
              }}
              onError={retryRemoteSrc}
            />
          ) : (
            <p className="spectacle-run-assembly-player__empty">
              {srcFailed
                ? `Не удалось открыть «${selectedLabel}»`
                : hasVideos
                  ? "Выберите ролик"
                  : "Добавьте видео во вкладке «Видео»"}
            </p>
          )}
        </div>
        <div className="spectacle-run-assembly-player__transport">
          <span className="spectacle-run-assembly-player__time">
            {formatPlaybackTime(displayTime)} / {formatPlaybackTime(displayDuration)}
          </span>
          <input
            ref={(el) => bindRangeFill(el, fillPercent)}
            className="spectacle-run-assembly-player__slider"
            type="range"
            min={0}
            max={seekMax}
            step={0.1}
            value={Math.min(displayTime, seekMax)}
            disabled={displayDuration <= 0}
            onChange={(event) => seekTo(event.target.value)}
            aria-label="Прогресс видео"
          />
        </div>
      </div>
    </section>
  );
}
