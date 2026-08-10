import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { useState } from "react";
import { Link } from "react-router-dom";
import { studioProgramPath } from "../../app/router/paths";
import type { StudioDetail } from "../../features/studio";
import { useCreateStudioModuleMutation } from "../../features/studio";
import { StudioLogo } from "./StudioLogo";
import "./style.css";

type StudioProgramPanelProps = {
  studio: StudioDetail;
};

function formatUpdatedAt(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
            const updatedLabel = formatUpdatedAt(module.updatedAt);
            const description = module.description?.trim() ?? "";
            const hasDescription = description.length > 0;
            const programHref = studioProgramPath(studio.id, module.id);

            return (
              <li key={module.id} className="studio-program-card-item">
                <Link to={programHref} className="studio-program-card">
                  <div className="studio-program-card__preview">
                    <StudioLogo
                      imageUrl={module.imageUrl}
                      title={module.title}
                      size="tile"
                    />
                    <span className="studio-program-card__badge">
                      Программа
                    </span>
                  </div>
                  <div className="studio-program-card__body">
                    <div className="studio-program-card__title">
                      {module.title}
                    </div>
                    <div className="studio-program-card__properties">
                      <p className="studio-program-card__text">
                        Уроки: {lessonCount}
                      </p>
                      {hasDescription ? (
                        <p className="studio-program-card__text studio-program-card__text--clamp">
                          Описание: {description}
                        </p>
                      ) : null}
                      <p className="studio-program-card__text">
                        Обновлено: {updatedLabel}
                      </p>
                    </div>
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
