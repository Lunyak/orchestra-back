import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { studioAssignmentPath } from "../../app/router/paths";
import type { StudioDetail } from "../../features/studio";
import { useCreateStudioAssignmentMutation } from "../../features/studio";
import "./style.css";

dayjs.locale("ru");

type StudioAssignmentsPanelProps = {
  studio: StudioDetail;
};

export function StudioAssignmentsPanel({ studio }: StudioAssignmentsPanelProps) {
  const canManage = studio.canManage;
  const assignments = studio.assignments;

  const [createAssignment, { isLoading: creating }] =
    useCreateStudioAssignmentMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const studentMembers = useMemo(
    () => studio.members.filter((member) => member.role === "student"),
    [studio.members],
  );

  const toggleEmail = (email: string) => {
    setSelectedEmails((rows) => {
      const next = new Set(rows);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    setFormError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Укажите название задания");
      return;
    }

    const targetEmails = [...selectedEmails];
    if (targetEmails.length === 0) {
      setFormError("Выберите хотя бы одного студиеца");
      return;
    }

    try {
      await createAssignment({
        studioId: studio.id,
        body: {
          title: trimmedTitle,
          description: description.trim() || undefined,
          dueAt: dueAt.trim() || undefined,
          targetEmails,
        },
      }).unwrap();
      setTitle("");
      setDescription("");
      setDueAt("");
      setSelectedEmails(new Set());
      setShowCreate(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Не удалось создать задание");
    }
  };

  return (
    <div className="studio-panel-section">
      <div className="studio-detail-header">
        <h2 className="studio-panel-section__title">Задания</h2>
        {canManage ? (
          <Button type="button" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Отмена" : "Новое задание"}
          </Button>
        ) : null}
      </div>

      {assignments.length === 0 ? (
        <p className="studio-page__hint">Заданий пока нет.</p>
      ) : (
        <ul className="studio-assignment-list">
          {assignments.map((assignment) => {
            const gradeLabel =
              assignment.mySubmission?.grade != null
                ? ` · оценка ${assignment.mySubmission.grade}`
                : "";
            const dueLabel = assignment.dueAt
              ? ` · до ${dayjs(assignment.dueAt).format("D MMM")}`
              : "";

            return (
              <li key={assignment.id}>
                <Link
                  to={studioAssignmentPath(studio.id, assignment.id)}
                  className="studio-assignment-item"
                >
                  <div className="studio-assignment-item__row">
                    <div>
                      <div className="studio-list-item__title">
                        {assignment.title}
                      </div>
                      <div className="studio-assignment-item__meta">
                        {assignment.submissionCount} / {assignment.targetCount} сдали
                        {dueLabel}
                        {gradeLabel}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {showCreate && canManage ? (
        <div className="studio-form-section">
          <h3 className="studio-form-section__title">Новое задание</h3>
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание"
            />
          </FormInlineRow>
          <FormInlineRow className="studio-form-row">
            <InlineTextField
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              placeholder="Срок (YYYY-MM-DD)"
            />
          </FormInlineRow>

          <h4 className="studio-form-section__title">Кому</h4>
          {studentMembers.length === 0 ? (
            <p className="studio-page__hint">Нет студиев в студии.</p>
          ) : (
            <ul className="studio-checkbox-list">
              {studentMembers.map((member) => (
                <li key={member.id} className="studio-checkbox-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedEmails.has(member.email)}
                      onChange={() => toggleEmail(member.email)}
                    />
                    {member.displayName} ({member.email})
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="studio-actions">
            <Button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? "Создание…" : "Создать"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
