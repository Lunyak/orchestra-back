import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../features/auth";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import {
  formatStudioTimecode,
  parseStudioTimecode,
  resolveStudioVideoEmbed,
  useCreateStudioMarkerMutation,
  useDeleteStudioMarkerMutation,
  useGetStudioVideoQuery,
} from "../../features/studio";
import "../../features/rehearsals/ui/rehearsals.css";
import "./style.css";

export function StudioVideoPage() {
  const { studioId = "", videoId = "" } = useParams();
  const { accessToken } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [seekSec, setSeekSec] = useState<number | null>(null);
  const [timecodeInput, setTimecodeInput] = useState("");
  const [markerBody, setMarkerBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: video, isLoading, error } = useGetStudioVideoQuery(
    { studioId, videoId },
    { skip: !accessToken || !studioId || !videoId },
  );

  const [createMarker, { isLoading: creating }] = useCreateStudioMarkerMutation();
  const [deleteMarker] = useDeleteStudioMarkerMutation();

  const canManage = video?.canManage ?? false;
  const myEmail = video?.myEmail?.trim().toLowerCase() ?? "";
  const embed = video ? resolveStudioVideoEmbed(video.url) : null;

  const sortedMarkers = useMemo(() => {
    const rows = video?.markers ?? [];
    return [...rows].sort((a, b) => a.timeSec - b.timeSec);
  }, [video?.markers]);

  const youtubeEmbedSrc = useMemo(() => {
    if (!embed || embed.kind !== "youtube") return null;
    const start = seekSec ?? 0;
    const startParam = start > 0 ? `&start=${start}` : "";
    return `${embed.embedUrl}?enablejsapi=1${startParam}`;
  }, [embed, seekSec]);

  const handleSeekMarker = (timeSec: number) => {
    if (embed?.kind === "youtube") {
      setSeekSec(timeSec);
      return;
    }
    if (embed?.kind === "direct" && videoRef.current) {
      videoRef.current.currentTime = timeSec;
      void videoRef.current.play();
    }
  };

  const handleMarkCurrentTime = () => {
    if (embed?.kind !== "direct" || !videoRef.current) return;
    const currentSec = Math.floor(videoRef.current.currentTime);
    setTimecodeInput(formatStudioTimecode(currentSec));
  };

  const handleCreateMarker = async () => {
    if (!video) return;
    setFormError(null);
    const timeSec = parseStudioTimecode(timecodeInput);
    const body = markerBody.trim();
    if (timeSec == null) {
      setFormError("Укажите время в формате mm:ss");
      return;
    }
    if (!body) {
      setFormError("Укажите текст метки");
      return;
    }

    try {
      await createMarker({
        studioId,
        videoId: video.id,
        body: { timeSec, body },
      }).unwrap();
      setTimecodeInput("");
      setMarkerBody("");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Не удалось добавить метку");
    }
  };

  const handleDeleteMarker = async (markerId: string) => {
    await deleteMarker({ studioId, videoId, markerId });
  };

  const canDeleteMarker = (authorEmail: string) => {
    const normalizedAuthor = authorEmail.trim().toLowerCase();
    return canManage || (myEmail && normalizedAuthor === myEmail);
  };

  if (isLoading) {
    return (
      <div className="app-layout studio-layout">
        <div className="app-content">
          <main className="main-content">
            <div className="studio-page">
              <p>Загрузка…</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !video || !embed) {
    return (
      <div className="app-layout studio-layout">
        <div className="app-content">
          <main className="main-content">
            <div className="studio-page">
              <Link className="studio-page__back" to={`/studio/${studioId}`}>
                ← Студия
              </Link>
              <p className="studio-page__error">Видео не найдено.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout studio-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="studio-page">
            <Link className="studio-page__back" to={`/studio/${studioId}`}>
              ← Студия
            </Link>

            <h1 className="studio-page__title">{video.title}</h1>
            {video.description ? (
              <p className="studio-page__subtitle">{video.description}</p>
            ) : null}

            <div className="studio-video-player">
              {embed.kind === "youtube" && youtubeEmbedSrc ? (
                <iframe
                  key={seekSec ?? 0}
                  className="studio-video-player__frame"
                  src={youtubeEmbedSrc}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : null}
              {embed.kind === "direct" ? (
                <video
                  ref={videoRef}
                  className="studio-video-player__video"
                  src={embed.src}
                  controls
                />
              ) : null}
              {embed.kind === "external" ? (
                <div className="studio-video-player__external">
                  <a href={embed.href} target="_blank" rel="noreferrer">
                    Открыть видео
                  </a>
                </div>
              ) : null}
            </div>

            <RehearsalsCard fluid>
              <div className="studio-marker-form">
                <h2 className="studio-panel-section__title">Новая метка</h2>
                {formError ? (
                  <p className="studio-page__error">{formError}</p>
                ) : null}
                <div className="studio-marker-form__row">
                  <FormInlineRow className="studio-form-row">
                    <InlineTextField
                      value={timecodeInput}
                      onChange={(e) => setTimecodeInput(e.target.value)}
                      placeholder="mm:ss"
                    />
                  </FormInlineRow>
                  {embed.kind === "direct" ? (
                    <Button type="button" variant="ghost" onClick={handleMarkCurrentTime}>
                      Метка сейчас
                    </Button>
                  ) : null}
                </div>
                <textarea
                  className="studio-textarea"
                  value={markerBody}
                  onChange={(e) => setMarkerBody(e.target.value)}
                  placeholder="Комментарий к моменту"
                />
                <div className="studio-actions">
                  <Button
                    type="button"
                    onClick={handleCreateMarker}
                    disabled={creating}
                  >
                    {creating ? "Добавление…" : "Добавить метку"}
                  </Button>
                </div>
              </div>

              <div className="studio-panel-section">
                <h2 className="studio-panel-section__title">Метки</h2>
                {sortedMarkers.length === 0 ? (
                  <p className="studio-page__hint">Меток пока нет.</p>
                ) : (
                  <ul className="studio-marker-list">
                    {sortedMarkers.map((marker) => {
                      const timeLabel = formatStudioTimecode(marker.timeSec);
                      const showDelete = canDeleteMarker(marker.authorEmail);

                      return (
                        <li key={marker.id} className="studio-marker-item">
                          <div className="studio-marker-item__row">
                            <div>
                              <button
                                type="button"
                                className="studio-marker-item__seek-link"
                                onClick={() => handleSeekMarker(marker.timeSec)}
                              >
                                {timeLabel}
                              </button>
                              {" · "}
                              {marker.body}
                              <div className="studio-marker-item__meta">
                                {marker.authorEmail}
                                {embed.kind === "youtube" ? (
                                  <>
                                    {" · "}
                                    <button
                                      type="button"
                                      className="studio-marker-item__seek-link"
                                      onClick={() => handleSeekMarker(marker.timeSec)}
                                    >
                                      открыть на {timeLabel}
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            {showDelete ? (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleDeleteMarker(marker.id)}
                              >
                                Удалить
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </RehearsalsCard>
          </div>
        </main>
      </div>
    </div>
  );
}
