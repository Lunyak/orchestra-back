import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { studioPath } from "../../app/router/paths";
import { useAuth } from "../../features/auth";
import orgPosterStudiosUrl from "../../features/organizations/assets/org-poster-studios.jpg";
import {
  studioRoleLabel,
  useCreateStudioMutation,
  useListStudiosQuery,
} from "../../features/studio";
import { StudioLogo } from "./StudioLogo";
import "./style.css";

function studioListErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { message?: string } }).data;
    if (data?.message) return String(data.message);
  }
  return "Не удалось загрузить студии";
}

export function StudiosPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { data, isLoading, isError, error } = useListStudiosQuery(undefined, {
    skip: !accessToken,
  });
  const [createStudio, { isLoading: creating }] = useCreateStudioMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const studios = data?.studios ?? [];
  const errorMessage = isError ? studioListErrorMessage(error) : null;
  const hasStudios = studios.length > 0;

  const handleToggleCreate = () => {
    setShowCreate((value) => !value);
    setFormError(null);
  };

  const handleCreate = async () => {
    setFormError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Укажите название студии");
      return;
    }

    try {
      const studio = await createStudio({
        title: trimmedTitle,
        description: description.trim() || undefined,
      }).unwrap();
      setTitle("");
      setDescription("");
      setShowCreate(false);
      navigate(studioPath(studio.id));
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Не удалось создать студию",
      );
    }
  };

  return (
    <div className="app-layout studio-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="studio-page">
            <div className="studio-page__content">
              <div className="studio-page__header">
                <div>
                  <h1 className="studio-page__title">Студия</h1>
                  <p className="studio-page__subtitle">
                    Онлайн-студии: участники, программа, задания и видео с
                    метками.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleToggleCreate}
                  disabled={!accessToken}
                >
                  {showCreate ? "Отмена" : "Новая студия"}
                </Button>
              </div>

              {errorMessage ? (
                <p className="studio-page__error">{errorMessage}</p>
              ) : null}

              {isLoading ? (
                <p className="studio-page__status">Загрузка…</p>
              ) : !hasStudios ? (
                <div className="studio-empty">
                  <p>Студий пока нет.</p>
                  {accessToken ? (
                    <Button type="button" onClick={handleToggleCreate}>
                      Создать первую студию
                    </Button>
                  ) : null}
                </div>
              ) : (
                <ul className="studio-poster-list">
                  {studios.map((studio) => {
                    const roleLabel = studioRoleLabel(studio.myRole);
                    const descriptionText = studio.description?.trim();
                    const metaParts = [roleLabel];
                    if (descriptionText) metaParts.push(descriptionText);
                    const metaText = metaParts.join(" · ");

                    return (
                      <li key={studio.id}>
                        <Link
                          to={studioPath(studio.id)}
                          className="studio-poster"
                        >
                          <span className="studio-poster__frame">
                            <StudioLogo
                              imageUrl={studio.imageUrl}
                              title={studio.title}
                              size="tile"
                              fallbackSrc={orgPosterStudiosUrl}
                            />
                          </span>
                          <span className="studio-poster__name">
                            {studio.title}
                          </span>
                          <span className="studio-poster__meta">{metaText}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}

              {showCreate ? (
                <div className="studio-form-section">
                  <h2 className="studio-form-section__title">Новая студия</h2>
                  {formError ? (
                    <p className="studio-page__error">{formError}</p>
                  ) : null}
                  <FormInlineRow className="studio-form-row">
                    <InlineTextField
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Название"
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
                    <Button
                      type="button"
                      onClick={handleCreate}
                      disabled={creating}
                    >
                      {creating ? "Создание…" : "Создать"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
