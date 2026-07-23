import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { StudioDetail } from "../../features/studio";
import { useCreateStudioModuleMutation } from "../../features/studio";
import { StudioLogo } from "./StudioLogo";
import "./style.css";

type StudioProgramPanelProps = {
  studio: StudioDetail;
};

export function StudioProgramPanel({ studio }: StudioProgramPanelProps) {
  const canManage = studio.canManage;
  const modules = studio.modules;

  const [createModule, { isLoading: creatingModule }] =
    useCreateStudioModuleMutation();

  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreateModule = async () => {
    setFormError(null);
    const title = moduleTitle.trim();
    if (!title) {
      setFormError("Укажите название программы");
      return;
    }

    try {
      await createModule({
        studioId: studio.id,
        body: {
          title,
          description: moduleDescription.trim() || undefined,
        },
      }).unwrap();
      setModuleTitle("");
      setModuleDescription("");
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Не удалось создать программу",
      );
    }
  };

  return (
    <div className="studio-panel-section">
      <h2 className="studio-panel-section__title">Программа</h2>

      {formError ? <p className="studio-page__error">{formError}</p> : null}

      {modules.length === 0 ? (
        <p className="studio-page__hint">Программ пока нет.</p>
      ) : (
        <ul className="studio-program-card-list">
          {modules.map((module) => {
            const lessonCount = module.lessons.length;
            const lessonLabel =
              lessonCount === 1
                ? "1 урок"
                : lessonCount > 1 && lessonCount < 5
                  ? `${lessonCount} урока`
                  : `${lessonCount} уроков`;

            return (
              <li key={module.id}>
                <Link
                  to={`/studio/${studio.id}/programs/${module.id}`}
                  className="studio-program-card"
                >
                  <StudioLogo
                    imageUrl={module.imageUrl}
                    title={module.title}
                    size="cover"
                  />
                  <div className="studio-program-card__body">
                    <div className="studio-program-card__title">
                      {module.title}
                    </div>
                    {module.description ? (
                      <p className="studio-program-card__description">
                        {module.description}
                      </p>
                    ) : (
                      <p className="studio-program-card__description studio-program-card__description--empty">
                        Без описания
                      </p>
                    )}
                    <div className="studio-program-card__meta">{lessonLabel}</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <div className="studio-form-section">
          <h3 className="studio-form-section__title">Новая программа</h3>
          <FormInlineRow className="studio-form-row">
            <InlineTextField
              value={moduleTitle}
              onChange={(e) => setModuleTitle(e.target.value)}
              placeholder="Название программы"
            />
          </FormInlineRow>
          <FormInlineRow className="studio-form-row">
            <InlineTextField
              value={moduleDescription}
              onChange={(e) => setModuleDescription(e.target.value)}
              placeholder="Краткое описание"
            />
          </FormInlineRow>
          <div className="studio-actions">
            <Button
              type="button"
              onClick={handleCreateModule}
              disabled={creatingModule}
            >
              {creatingModule ? "Создание…" : "Добавить программу"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
