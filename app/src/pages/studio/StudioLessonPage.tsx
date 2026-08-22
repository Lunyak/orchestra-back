import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
import cn from "classnames";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { studioProgramPath } from "../../app/router/paths";
import { useAuth } from "../../features/auth";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import {
  studioLessonProgressLabel,
  studioLessonTaskLabel,
  useGetStudioLessonQuery,
  useGetStudioQuery,
  useReviewStudioLessonProgressMutation,
  useSubmitStudioLessonMutation,
  useUpdateStudioLessonMutation,
  type StudioLessonProgressStatus,
  type StudioLessonTaskType,
} from "../../features/studio";
import { PersonSelectPreview } from "../../shared/components/person-select/PersonSelectPreview";
import "../../features/rehearsals/ui/rehearsals.css";
import "./style.css";

function LessonBodyEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder: string;
  readOnly?: boolean;
}) {
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

  if (readOnly) {
    return value ? (
      <div className="studio-lesson-page__body">{value}</div>
    ) : (
      <p className="studio-page__hint">Описание пока не добавлено.</p>
    );
  }

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
    requestAnimationFrame(syncHeight);
  };

  return (
    <textarea
      ref={ref}
      className="studio-lesson-page__body-edit"
      value={value}
      onChange={handleChange}
      onBlur={onBlur}
      placeholder={placeholder}
      rows={4}
    />
  );
}

function progressStatusClass(status: StudioLessonProgressStatus): string {
  if (status === "completed") return "studio-progress-status--completed";
  if (status === "submitted") return "studio-progress-status--submitted";
  if (status === "rejected") return "studio-progress-status--rejected";
  return "studio-progress-status--pending";
}

export function StudioLessonPage() {
  const { studioId = "", programId = "", lessonId = "" } = useParams();
  const { accessToken } = useAuth();

  const { data: studio } = useGetStudioQuery(studioId, {
    skip: !accessToken || !studioId,
  });
  const { data: lesson, isLoading, error } = useGetStudioLessonQuery(
    { studioId, moduleId: programId, lessonId },
    { skip: !accessToken || !studioId || !programId || !lessonId },
  );

  const [updateLesson] = useUpdateStudioLessonMutation();
  const [submitLesson, { isLoading: submitting }] =
    useSubmitStudioLessonMutation();
  const [reviewProgress, { isLoading: reviewing }] =
    useReviewStudioLessonProgressMutation();

  const [videoUrl, setVideoUrl] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = lesson?.canManage ?? false;
  const myStatus = lesson?.myProgress?.status ?? "pending";

  const persistTitle = useCallback(
    (id: string, text: string) => {
      if (!lesson) return;
      const title = text.trim();
      if (!title || title === lesson.title) return;
      void updateLesson({
        studioId,
        moduleId: programId,
        lessonId: id,
        body: { title },
      });
    },
    [lesson, programId, studioId, updateLesson],
  );

  const persistBody = useCallback(
    (id: string, text: string) => {
      if (!lesson) return;
      const body = text.trim() || null;
      const current = lesson.body?.trim() || null;
      if (body === current) return;
      void updateLesson({
        studioId,
        moduleId: programId,
        lessonId: id,
        body: { body },
      });
    },
    [lesson, programId, studioId, updateLesson],
  );

  const persistPrompt = useCallback(
    (id: string, text: string) => {
      if (!lesson) return;
      const taskPrompt = text.trim() || null;
      const current = lesson.taskPrompt?.trim() || null;
      if (taskPrompt === current) return;
      void updateLesson({
        studioId,
        moduleId: programId,
        lessonId: id,
        body: { taskPrompt },
      });
    },
    [lesson, programId, studioId, updateLesson],
  );

  const titleField = useDebouncedSyncedText(
    lesson?.id ?? "",
    lesson?.title ?? "",
    persistTitle,
  );
  const bodyField = useDebouncedSyncedText(
    lesson?.id ?? "",
    lesson?.body ?? "",
    persistBody,
  );
  const promptField = useDebouncedSyncedText(
    lesson?.id ?? "",
    lesson?.taskPrompt ?? "",
    persistPrompt,
  );

  const handleTaskTypeChange = async (taskType: StudioLessonTaskType) => {
    if (!lesson || taskType === lesson.taskType) return;
    await updateLesson({
      studioId,
      moduleId: programId,
      lessonId: lesson.id,
      body: { taskType },
    });
  };

  const handleComplete = async () => {
    if (!lesson) return;
    setFormError(null);
    try {
      await submitLesson({
        studioId,
        moduleId: programId,
        lessonId: lesson.id,
        body: { mode: "complete", note: note.trim() || undefined },
      }).unwrap();
      setNote("");
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Не удалось отметить урок",
      );
    }
  };

  const handleSubmitVideo = async () => {
    if (!lesson) return;
    setFormError(null);
    const trimmed = videoUrl.trim();
    if (!trimmed) {
      setFormError("Укажите ссылку на видео");
      return;
    }
    try {
      await submitLesson({
        studioId,
        moduleId: programId,
        lessonId: lesson.id,
        body: {
          mode: "video",
          videoUrl: trimmed,
          note: note.trim() || undefined,
        },
      }).unwrap();
      setVideoUrl("");
      setNote("");
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Не удалось отправить видео",
      );
    }
  };

  const handleReview = async (
    progressId: string,
    status: "completed" | "rejected",
  ) => {
    await reviewProgress({
      studioId,
      moduleId: programId,
      lessonId,
      progressId,
      body: { status },
    });
  };

  if (isLoading) {
    return <PageLoader label="Загрузка…" />;
  }

  if (error || !lesson) {
    return (
      <div className="app-layout studio-layout">
        <div className="app-content">
          <main className="main-content">
            <div className="studio-page">
              <Link
                className="studio-page__back"
                to={studioProgramPath(studioId, programId)}
              >
                ← Программа
              </Link>
              <p className="studio-page__error">Урок не найден.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const backTitle = lesson.module.title || studio?.title || "Программа";
  const showStudentTask = lesson.myRole === "student";
  const canSubmitTask =
    showStudentTask &&
    myStatus !== "completed" &&
    myStatus !== "submitted";

  return (
    <div className="app-layout studio-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="studio-page">
            <Link
              className="studio-page__back"
              to={studioProgramPath(studioId, programId)}
            >
              ← {backTitle}
            </Link>

            <RehearsalsCard fluid>
              <div className="studio-lesson-page__header">
                {canManage ? (
                  <InlineTextField
                    className="studio-inline-title studio-inline-title--page"
                    value={titleField.draft}
                    onChange={(e) => titleField.onChange(e.target.value)}
                    onBlur={titleField.onBlur}
                    placeholder="Название урока"
                  />
                ) : (
                  <h1 className="studio-page__title">{lesson.title}</h1>
                )}
                <span className="studio-role-badge">
                  {studioLessonTaskLabel(lesson.taskType)}
                </span>
              </div>

              <div className="studio-panel-section">
                <h2 className="studio-panel-section__title">Описание</h2>
                <LessonBodyEditor
                  value={canManage ? bodyField.draft : lesson.body ?? ""}
                  onChange={bodyField.onChange}
                  onBlur={bodyField.onBlur}
                  placeholder="Подробное описание урока"
                  readOnly={!canManage}
                />
              </div>

              <div className="studio-panel-section">
                <h2 className="studio-panel-section__title">Задание</h2>
                {canManage ? (
                  <>
                    <div className="studio-task-type-row">
                      <button
                        type="button"
                        className={cn(
                          "studio-task-type-btn",
                          lesson.taskType === "complete" &&
                            "studio-task-type-btn--active",
                        )}
                        onClick={() => void handleTaskTypeChange("complete")}
                      >
                        Кнопка «Выполнено»
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "studio-task-type-btn",
                          lesson.taskType === "video" &&
                            "studio-task-type-btn--active",
                        )}
                        onClick={() => void handleTaskTypeChange("video")}
                      >
                        Сдать видео
                      </button>
                    </div>
                    <LessonBodyEditor
                      value={promptField.draft}
                      onChange={promptField.onChange}
                      onBlur={promptField.onBlur}
                      placeholder="Текст задания для студийца"
                    />
                  </>
                ) : lesson.taskPrompt ? (
                  <div className="studio-lesson-page__body">
                    {lesson.taskPrompt}
                  </div>
                ) : (
                  <p className="studio-page__hint">
                    {lesson.taskType === "video"
                      ? "Сдайте видео по этому уроку."
                      : "Отметьте урок выполненным, когда закончите."}
                  </p>
                )}
              </div>

              {showStudentTask ? (
                <div className="studio-form-section">
                  <h2 className="studio-form-section__title">Ваш прогресс</h2>
                  <p
                    className={cn(
                      "studio-progress-status",
                      progressStatusClass(myStatus),
                    )}
                  >
                    {studioLessonProgressLabel(myStatus)}
                  </p>
                  {lesson.myProgress?.reviewComment ? (
                    <p className="studio-page__hint">
                      Комментарий: {lesson.myProgress.reviewComment}
                    </p>
                  ) : null}
                  {lesson.myProgress?.videoUrl ? (
                    <p className="studio-page__hint">
                      Видео:{" "}
                      <a
                        href={lesson.myProgress.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {lesson.myProgress.videoUrl}
                      </a>
                    </p>
                  ) : null}

                  {formError ? (
                    <p className="studio-page__error">{formError}</p>
                  ) : null}

                  {canSubmitTask ? (
                    <>
                      {lesson.taskType === "video" ? (
                        <FormInlineRow className="studio-form-row">
                          <InlineTextField
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            placeholder="Ссылка на видео"
                          />
                        </FormInlineRow>
                      ) : null}
                      <FormInlineRow className="studio-form-row">
                        <InlineTextField
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Комментарий (необязательно)"
                        />
                      </FormInlineRow>
                      <div className="studio-actions">
                        {lesson.taskType === "complete" ? (
                          <Button
                            type="button"
                            onClick={handleComplete}
                            disabled={submitting}
                          >
                            {submitting ? "Сохранение…" : "Выполнено"}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            onClick={handleSubmitVideo}
                            disabled={submitting}
                          >
                            {submitting ? "Отправка…" : "Сдать видео"}
                          </Button>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {canManage && lesson.stats ? (
                <div className="studio-panel-section">
                  <h2 className="studio-panel-section__title">
                    Прогресс студийцев
                  </h2>
                  <div className="studio-lesson-stats">
                    <span>
                      Всего: {lesson.stats.totalStudents}
                    </span>
                    <span>
                      Выполнено: {lesson.stats.completed}
                    </span>
                    <span>
                      На проверке: {lesson.stats.submitted}
                    </span>
                    <span>
                      Не выполнено: {lesson.stats.pending}
                    </span>
                    {lesson.stats.rejected > 0 ? (
                      <span>
                        Отклонено: {lesson.stats.rejected}
                      </span>
                    ) : null}
                  </div>

                  {!lesson.roster || lesson.roster.length === 0 ? (
                    <p className="studio-page__hint">
                      В студии пока нет студийцев.
                    </p>
                  ) : (
                    <ul className="studio-lesson-roster">
                      {lesson.roster.map((row) => {
                        const status = row.progress?.status ?? "pending";
                        const needsReview = status === "submitted";
                        return (
                          <li
                            key={row.email}
                            className="studio-lesson-roster__item"
                          >
                            <PersonSelectPreview
                              person={{
                                email: row.email,
                                profile: {
                                  displayName: row.displayName,
                                  avatarUrl: row.avatarUrl,
                                },
                              }}
                              compact
                            />
                            <div className="studio-lesson-roster__meta">
                              <span
                                className={cn(
                                  "studio-progress-status",
                                  progressStatusClass(status),
                                )}
                              >
                                {studioLessonProgressLabel(status)}
                              </span>
                              {row.progress?.videoUrl ? (
                                <a
                                  className="studio-lesson-roster__video"
                                  href={row.progress.videoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Видео
                                </a>
                              ) : null}
                              {row.progress?.note ? (
                                <span className="studio-page__hint">
                                  {row.progress.note}
                                </span>
                              ) : null}
                            </div>
                            {needsReview && row.progress ? (
                              <div className="studio-lesson-roster__actions">
                                <Button
                                  type="button"
                                  onClick={() =>
                                    void handleReview(
                                      row.progress!.id,
                                      "completed",
                                    )
                                  }
                                  disabled={reviewing}
                                >
                                  Принять
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() =>
                                    void handleReview(
                                      row.progress!.id,
                                      "rejected",
                                    )
                                  }
                                  disabled={reviewing}
                                >
                                  Отклонить
                                </Button>
                              </div>
                            ) : null}
                            {status === "completed" &&
                            row.progress &&
                            lesson.taskType === "complete" ? (
                              <div className="studio-lesson-roster__actions">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() =>
                                    void handleReview(
                                      row.progress!.id,
                                      "rejected",
                                    )
                                  }
                                  disabled={reviewing}
                                >
                                  Сбросить
                                </Button>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </RehearsalsCard>
          </div>
        </main>
      </div>
    </div>
  );
}
