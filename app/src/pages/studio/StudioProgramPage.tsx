import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
import cn from "classnames";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../features/auth";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import type { StudioLessonTaskType, StudioProgramModule } from "../../features/studio";
import {
  studioLessonTaskLabel,
  useCreateStudioLessonMutation,
  useGetStudioQuery,
  useUpdateStudioModuleMutation,
} from "../../features/studio";
import { uploadProjectFile } from "../../sync/api/files";
import { StudioLogo, toStudioImageStorageRef } from "./StudioLogo";
import "../../features/rehearsals/ui/rehearsals.css";
import "./style.css";

function StudioInlineDescription(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const { value, onChange, className, ...rest } = props;
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(event);
    requestAnimationFrame(syncHeight);
  };

  return (
    <textarea
      {...rest}
      ref={ref}
      className={className}
      value={value}
      onChange={handleChange}
      rows={1}
    />
  );
}

function StudioProgramHeaderEditor({
  studioId,
  module,
}: {
  studioId: string;
  module: StudioProgramModule;
}) {
  const { accessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [updateModule] = useUpdateStudioModuleMutation();
  const [uploading, setUploading] = useState(false);

  const persistTitle = useCallback(
    (moduleId: string, text: string) => {
      const title = text.trim();
      if (!title || title === module.title) return;
      void updateModule({
        studioId,
        moduleId,
        body: { title },
      });
    },
    [module.title, studioId, updateModule],
  );

  const persistDescription = useCallback(
    (moduleId: string, text: string) => {
      const description = text.trim() || null;
      const current = module.description?.trim() || null;
      if (description === current) return;
      void updateModule({
        studioId,
        moduleId,
        body: { description },
      });
    },
    [module.description, studioId, updateModule],
  );

  const titleField = useDebouncedSyncedText(
    module.id,
    module.title,
    persistTitle,
  );
  const descriptionField = useDebouncedSyncedText(
    module.id,
    module.description ?? "",
    persistDescription,
  );

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !accessToken) return;
    if (!file.type.startsWith("image/")) return;

    setUploading(true);
    try {
      const uploaded = await uploadProjectFile(accessToken, {
        projectId: `studio-${studioId}`,
        type: "image",
        file,
      });
      await updateModule({
        studioId,
        moduleId: module.id,
        body: { imageUrl: toStudioImageStorageRef(uploaded) },
      }).unwrap();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="studio-program-page__header">
      <div className="studio-program-page__cover-block">
        <button
          type="button"
          className="studio-program-page__cover-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={!accessToken || uploading}
          title="Загрузить обложку"
        >
          <StudioLogo
            imageUrl={module.imageUrl}
            title={titleField.draft || module.title}
            size="cover"
          />
          <span className="studio-program-page__cover-hint">
            {uploading
              ? "Загрузка…"
              : module.imageUrl
                ? "Сменить обложку"
                : "Добавить обложку"}
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="studio-file-input"
          onChange={handleFileChange}
        />
      </div>
      <div className="studio-program-fields">
        <InlineTextField
          className="studio-inline-title"
          value={titleField.draft}
          onChange={(e) => titleField.onChange(e.target.value)}
          onBlur={titleField.onBlur}
          placeholder="Название программы"
        />
        <StudioInlineDescription
          className="studio-inline-description"
          value={descriptionField.draft}
          onChange={(e) => descriptionField.onChange(e.target.value)}
          onBlur={descriptionField.onBlur}
          placeholder="Описание программы"
        />
      </div>
    </div>
  );
}

export function StudioProgramPage() {
  const { studioId = "", programId = "" } = useParams();
  const { accessToken } = useAuth();
  const { data: studio, isLoading, error } = useGetStudioQuery(studioId, {
    skip: !accessToken || !studioId,
  });

  const [createLesson, { isLoading: creatingLesson }] =
    useCreateStudioLessonMutation();
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonBody, setLessonBody] = useState("");
  const [lessonTaskType, setLessonTaskType] =
    useState<StudioLessonTaskType>("complete");
  const [formError, setFormError] = useState<string | null>(null);

  const module = studio?.modules.find((row) => row.id === programId) ?? null;
  const canManage = studio?.canManage ?? false;

  const handleCreateLesson = async () => {
    if (!module) return;
    setFormError(null);
    const title = lessonTitle.trim();
    if (!title) {
      setFormError("Укажите название урока");
      return;
    }
    try {
      await createLesson({
        studioId,
        moduleId: module.id,
        body: {
          title,
          body: lessonBody.trim() || undefined,
          taskType: lessonTaskType,
        },
      }).unwrap();
      setLessonTitle("");
      setLessonBody("");
      setLessonTaskType("complete");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Не удалось создать урок");
    }
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

  if (error || !studio || !module) {
    return (
      <div className="app-layout studio-layout">
        <div className="app-content">
          <main className="main-content">
            <div className="studio-page">
              <Link className="studio-page__back" to={`/studio/${studioId}`}>
                ← Студия
              </Link>
              <p className="studio-page__error">Программа не найдена.</p>
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
              ← {studio.title}
            </Link>

            <RehearsalsCard fluid>
              {canManage ? (
                <StudioProgramHeaderEditor
                  studioId={studioId}
                  module={module}
                />
              ) : (
                <div className="studio-program-page__header">
                  <StudioLogo
                    imageUrl={module.imageUrl}
                    title={module.title}
                    size="cover"
                  />
                  <div className="studio-program-fields">
                    <h1 className="studio-page__title">{module.title}</h1>
                    {module.description ? (
                      <p className="studio-page__subtitle">
                        {module.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="studio-panel-section">
                <h2 className="studio-panel-section__title">Уроки</h2>

                {formError ? (
                  <p className="studio-page__error">{formError}</p>
                ) : null}

                {module.lessons.length === 0 ? (
                  <p className="studio-page__hint">Уроков пока нет.</p>
                ) : (
                  <ul className="studio-lesson-list studio-lesson-list--page">
                    {module.lessons.map((lesson) => {
                      const lessonPath = `/studio/${studioId}/programs/${module.id}/lessons/${lesson.id}`;
                      const taskType = lesson.taskType ?? "complete";
                      return (
                        <li key={lesson.id} className="studio-lesson-item">
                          <Link
                            className="studio-lesson-link"
                            to={lessonPath}
                          >
                            <span className="studio-lesson-item__title">
                              {lesson.title}
                            </span>
                            <span className="studio-role-badge">
                              {studioLessonTaskLabel(taskType)}
                            </span>
                          </Link>
                          {lesson.body ? (
                            <div className="studio-lesson-item__body">
                              {lesson.body}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {canManage ? (
                  <div className="studio-form-section">
                    <h3 className="studio-form-section__title">Новый урок</h3>
                    <FormInlineRow className="studio-form-row">
                      <InlineTextField
                        value={lessonTitle}
                        onChange={(e) => setLessonTitle(e.target.value)}
                        placeholder="Название урока"
                      />
                    </FormInlineRow>
                    <textarea
                      className="studio-textarea"
                      value={lessonBody}
                      onChange={(e) => setLessonBody(e.target.value)}
                      placeholder="Краткое описание"
                    />
                    <div className="studio-task-type-row">
                      <button
                        type="button"
                        className={cn(
                          "studio-task-type-btn",
                          lessonTaskType === "complete" &&
                            "studio-task-type-btn--active",
                        )}
                        onClick={() => setLessonTaskType("complete")}
                      >
                        Кнопка «Выполнено»
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "studio-task-type-btn",
                          lessonTaskType === "video" &&
                            "studio-task-type-btn--active",
                        )}
                        onClick={() => setLessonTaskType("video")}
                      >
                        Сдать видео
                      </button>
                    </div>
                    <div className="studio-actions">
                      <Button
                        type="button"
                        onClick={handleCreateLesson}
                        disabled={creatingLesson}
                      >
                        {creatingLesson ? "Добавление…" : "Добавить урок"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </RehearsalsCard>
          </div>
        </main>
      </div>
    </div>
  );
}
