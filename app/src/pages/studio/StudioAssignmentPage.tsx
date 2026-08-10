import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { studioPath } from "../../app/router/paths";
import { useAuth } from "../../features/auth";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import {
  useGetStudioAssignmentQuery,
  useGetStudioQuery,
  useGradeStudioSubmissionMutation,
  useSubmitStudioAssignmentMutation,
} from "../../features/studio";
import "../../features/rehearsals/ui/rehearsals.css";
import "./style.css";

dayjs.locale("ru");

export function StudioAssignmentPage() {
  const { studioId = "", assignmentId = "" } = useParams();
  const { accessToken } = useAuth();

  const { data: studio } = useGetStudioQuery(studioId, {
    skip: !accessToken || !studioId,
  });
  const { data: assignment, isLoading, error } = useGetStudioAssignmentQuery(
    { studioId, assignmentId },
    { skip: !accessToken || !studioId || !assignmentId },
  );

  const [submitAssignment, { isLoading: submitting }] =
    useSubmitStudioAssignmentMutation();
  const [gradeSubmission, { isLoading: grading }] =
    useGradeStudioSubmissionMutation();

  const [body, setBody] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [gradeDrafts, setGradeDrafts] = useState<
    Record<string, { grade: string; comment: string }>
  >({});

  const canManage = studio?.canManage ?? false;

  const memberLabelByEmail = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of studio?.members ?? []) {
      map.set(member.email, member.displayName);
    }
    return map;
  }, [studio?.members]);

  const getGradeDraft = (submissionId: string) =>
    gradeDrafts[submissionId] ?? { grade: "5", comment: "" };

  const setGradeDraft = (
    submissionId: string,
    patch: Partial<{ grade: string; comment: string }>,
  ) => {
    setGradeDrafts((rows) => ({
      ...rows,
      [submissionId]: { ...getGradeDraft(submissionId), ...patch },
    }));
  };

  const handleSubmit = async () => {
    if (!assignment) return;
    setFormError(null);
    const trimmedBody = body.trim();
    const trimmedVideoUrl = videoUrl.trim();
    if (!trimmedBody && !trimmedVideoUrl) {
      setFormError("Укажите текст или ссылку на видео");
      return;
    }

    try {
      await submitAssignment({
        studioId,
        assignmentId: assignment.id,
        body: {
          body: trimmedBody || undefined,
          videoUrl: trimmedVideoUrl || undefined,
        },
      }).unwrap();
      setBody("");
      setVideoUrl("");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Не удалось отправить работу");
    }
  };

  const handleGrade = async (submissionId: string) => {
    const draft = getGradeDraft(submissionId);
    const grade = Number(draft.grade);
    if (!Number.isFinite(grade) || grade < 1 || grade > 5) {
      setFormError("Оценка от 1 до 5");
      return;
    }

    await gradeSubmission({
      studioId,
      assignmentId,
      submissionId,
      body: {
        grade,
        gradeComment: draft.comment.trim() || undefined,
      },
    });
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

  if (error || !assignment) {
    return (
      <div className="app-layout studio-layout">
        <div className="app-content">
          <main className="main-content">
            <div className="studio-page">
              <Link className="studio-page__back" to={studioPath(studioId)}>
                ← Студия
              </Link>
              <p className="studio-page__error">Задание не найдено.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const dueLabel = assignment.dueAt
    ? dayjs(assignment.dueAt).format("D MMMM YYYY")
    : null;

  return (
    <div className="app-layout studio-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="studio-page">
            <Link className="studio-page__back" to={studioPath(studioId)}>
              ← Студия
            </Link>

            <h1 className="studio-page__title">{assignment.title}</h1>
            {dueLabel ? (
              <p className="studio-page__subtitle">Срок: {dueLabel}</p>
            ) : null}
            {assignment.description ? (
              <p className="studio-page__hint">{assignment.description}</p>
            ) : null}

            <RehearsalsCard fluid>
              <div className="studio-panel-section">
                <h2 className="studio-panel-section__title">Адресаты</h2>
                <div className="studio-target-list">
                  {assignment.targetEmails.map((email) => (
                    <span key={email} className="studio-target-chip">
                      {memberLabelByEmail.get(email) ?? email}
                    </span>
                  ))}
                </div>
              </div>

              {assignment.canSubmit ? (
                <div className="studio-form-section">
                  <h2 className="studio-form-section__title">Ваша работа</h2>
                  {formError ? (
                    <p className="studio-page__error">{formError}</p>
                  ) : null}
                  <textarea
                    className="studio-textarea"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Текст ответа"
                  />
                  <FormInlineRow className="studio-form-row">
                    <InlineTextField
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="Ссылка на видео"
                    />
                  </FormInlineRow>
                  <div className="studio-actions">
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? "Отправка…" : "Отправить"}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="studio-panel-section">
                <h2 className="studio-panel-section__title">
                  {canManage ? "Работы студиев" : "Ваша отправка"}
                </h2>
                {assignment.submissions.length === 0 ? (
                  <p className="studio-page__hint">Работ пока нет.</p>
                ) : (
                  <ul className="studio-submission-list">
                    {assignment.submissions.map((submission) => {
                      const gradeDraft = getGradeDraft(submission.id);
                      const existingGrade =
                        submission.grade != null
                          ? String(submission.grade)
                          : gradeDraft.grade;
                      const existingComment =
                        submission.gradeComment ?? gradeDraft.comment;

                      return (
                        <li key={submission.id} className="studio-submission-item">
                          <div className="studio-submission-item__row">
                            <div>
                              <div className="studio-member-item__name">
                                {memberLabelByEmail.get(submission.email) ??
                                  submission.email}
                              </div>
                              <div className="studio-member-item__meta">
                                {dayjs(submission.submittedAt).format(
                                  "D MMM YYYY, HH:mm",
                                )}
                                {submission.grade != null
                                  ? ` · оценка ${submission.grade}`
                                  : ""}
                              </div>
                            </div>
                          </div>
                          {submission.body ? (
                            <div className="studio-lesson-item__body">
                              {submission.body}
                            </div>
                          ) : null}
                          {submission.videoUrl ? (
                            <p className="studio-page__hint">
                              <a
                                href={submission.videoUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Видео
                              </a>
                            </p>
                          ) : null}
                          {submission.gradeComment ? (
                            <p className="studio-page__hint">
                              Комментарий: {submission.gradeComment}
                            </p>
                          ) : null}

                          {canManage ? (
                            <div className="studio-grade-form">
                              <div className="studio-grade-form__row">
                                <label>
                                  Оценка{" "}
                                  <select
                                    className="studio-select"
                                    value={existingGrade}
                                    onChange={(e) =>
                                      setGradeDraft(submission.id, {
                                        grade: e.target.value,
                                      })
                                    }
                                  >
                                    {[1, 2, 3, 4, 5].map((value) => (
                                      <option key={value} value={value}>
                                        {value}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <textarea
                                className="studio-textarea"
                                value={existingComment}
                                onChange={(e) =>
                                  setGradeDraft(submission.id, {
                                    comment: e.target.value,
                                  })
                                }
                                placeholder="Комментарий"
                              />
                              <div className="studio-actions">
                                <Button
                                  type="button"
                                  onClick={() => handleGrade(submission.id)}
                                  disabled={grading}
                                >
                                  {grading ? "Сохранение…" : "Выставить оценку"}
                                </Button>
                              </div>
                            </div>
                          ) : null}
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
