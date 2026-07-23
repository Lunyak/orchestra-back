import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { StudioDetail } from "../../features/studio";
import { useCreateStudioVideoMutation } from "../../features/studio";
import "./style.css";

type StudioVideosPanelProps = {
  studio: StudioDetail;
};

export function StudioVideosPanel({ studio }: StudioVideosPanelProps) {
  const navigate = useNavigate();
  const videos = studio.videos;

  const [createVideo, { isLoading: creating }] = useCreateStudioVideoMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async () => {
    setFormError(null);
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    if (!trimmedTitle) {
      setFormError("Укажите название");
      return;
    }
    if (!trimmedUrl) {
      setFormError("Укажите ссылку на видео");
      return;
    }

    try {
      const video = await createVideo({
        studioId: studio.id,
        body: {
          title: trimmedTitle,
          url: trimmedUrl,
          description: description.trim() || undefined,
        },
      }).unwrap();
      setTitle("");
      setUrl("");
      setDescription("");
      setShowCreate(false);
      navigate(`/studio/${studio.id}/videos/${video.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Не удалось добавить видео");
    }
  };

  return (
    <div className="studio-panel-section">
      <div className="studio-detail-header">
        <h2 className="studio-panel-section__title">Видео</h2>
        <Button type="button" onClick={() => setShowCreate((value) => !value)}>
          {showCreate ? "Отмена" : "Добавить видео"}
        </Button>
      </div>

      {videos.length === 0 ? (
        <p className="studio-page__hint">Видео пока нет.</p>
      ) : (
        <ul className="studio-video-list">
          {videos.map((video) => (
            <li key={video.id}>
              <Link
                to={`/studio/${studio.id}/videos/${video.id}`}
                className="studio-video-item"
              >
                <div className="studio-video-item__row">
                  <div>
                    <div className="studio-list-item__title">{video.title}</div>
                    <div className="studio-video-item__meta">
                      {video.markerCount} меток · {video.uploadedByEmail}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showCreate ? (
        <div className="studio-form-section">
          <h3 className="studio-form-section__title">Новое видео</h3>
          {formError ? <p className="studio-page__error">{formError}</p> : null}
          <FormInlineRow className="studio-form-row">
            <InlineTextField
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название"
            />
          </FormInlineRow>
          <FormInlineRow className="studio-form-row">
            <InlineTextField
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL (YouTube или .mp4)"
            />
          </FormInlineRow>
          <FormInlineRow className="studio-form-row">
            <InlineTextField
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание"
            />
          </FormInlineRow>
          <div className="studio-actions">
            <Button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? "Добавление…" : "Добавить"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
