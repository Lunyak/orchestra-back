import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useAddTeamRoleAssignmentMutation,
  useRemoveTeamRoleMutation,
  useRemoveTeamRoleAssignmentMutation,
  useTeamRoleQuery,
  useTeamRolesQuery,
  useUpdateTeamRoleMutation,
} from "../../features/troupe/api/troupe-api";
import { memberLabel } from "../../features/troupe";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import "./style.css";

export function TeamRolePage() {
  const { roleId = "" } = useParams();
  const navigate = useNavigate();
  const [titleDraft, setTitleDraft] = useState("");
  const [parentIdDraft, setParentIdDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: role, isLoading } = useTeamRoleQuery(
    { roleId },
    { skip: !roleId },
  );
  const { data: teamRoles = [] } = useTeamRolesQuery(undefined);
  const [updateRole, { isLoading: savingRole }] = useUpdateTeamRoleMutation();
  const [removeRole, { isLoading: removingRole }] = useRemoveTeamRoleMutation();
  const [addAssignment, { isLoading: addingAssignment }] =
    useAddTeamRoleAssignmentMutation();
  const [removeAssignment] = useRemoveTeamRoleAssignmentMutation();

  useEffect(() => {
    if (!role) return;
    setTitleDraft(role.title);
    setParentIdDraft(role.parentId ?? "");
    setDescriptionDraft(role.description);
  }, [role]);

  const parentRoleOptions = useMemo(
    () => [
      { value: "", label: "Верхний уровень" },
      ...teamRoles
        .filter((item) => item.id !== role?.id)
        .map((item) => ({
          value: item.id,
          label: item.title,
        })),
    ],
    [role?.id, teamRoles],
  );

  const handleSave = async () => {
    if (!role) return;
    setError(null);
    try {
      await updateRole({
        roleId: role.id,
        patch: {
          title: titleDraft.trim(),
          parentId: parentIdDraft || null,
          description: descriptionDraft,
        },
      }).unwrap();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить должность");
    }
  };

  const handleAddAssignment = async () => {
    if (!role) return;
    const email = emailDraft.trim();
    if (!email) return;
    setError(null);
    try {
      await addAssignment({ roleId: role.id, email }).unwrap();
      setEmailDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось назначить человека");
    }
  };

  const handleRemoveRole = async () => {
    if (!role) return;
    const confirmed = confirm(
      "Удалить должность? Назначения на эту должность тоже будут удалены.",
    );
    if (!confirmed) return;
    setError(null);
    try {
      await removeRole({ roleId: role.id }).unwrap();
      navigate("/troupe");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить должность");
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!role) return;
    setError(null);
    try {
      await removeAssignment({ roleId: role.id, assignmentId }).unwrap();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось снять назначение");
    }
  };

  if (isLoading) {
    return <div className="troupe-role-page">Загружаем должность…</div>;
  }

  if (!role) {
    return (
      <div className="troupe-role-page">
        <Link className="troupe-role-page__back" to="/troupe">
          ← Команда
        </Link>
        <div className="troupe-error">Должность не найдена</div>
      </div>
    );
  }

  return (
    <div className="app-layout troupe-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="troupe-view troupe-role-page">
            <Link className="troupe-role-page__back" to="/troupe">
              ← Команда
            </Link>

            <div className="troupe-card troupe-role-page-card">
              <div className="troupe-team-title">Карточка должности</div>
              <FormInlineRow className="troupe-form-row">
                <InlineTextField
                  className="troupe-title-field"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  maxLength={80}
                  aria-label="Название должности"
                />
                <CustomSelect
                  value={parentIdDraft}
                  options={parentRoleOptions}
                  onChange={setParentIdDraft}
                  triggerClassName="troupe-role-parent-select"
                  aria-label="Родительская должность"
                />
                <Button
                  type="button"
                  variant="primary"
                  disabled={
                    savingRole ||
                    !titleDraft.trim() ||
                    (titleDraft.trim() === role.title.trim() &&
                      parentIdDraft === (role.parentId ?? "") &&
                      descriptionDraft === role.description)
                  }
                  onClick={() => {
                    void handleSave();
                  }}
                >
                  {savingRole ? "Сохранение…" : "Сохранить"}
                </Button>
                <Button
                  type="button"
                  className="danger"
                  disabled={removingRole}
                  onClick={() => {
                    void handleRemoveRole();
                  }}
                >
                  {removingRole ? "Удаление…" : "Удалить должность"}
                </Button>
              </FormInlineRow>
              <label className="troupe-role-page__instruction">
                <span className="troupe-card__field-label">
                  Должностная инструкция
                </span>
                <textarea
                  className="troupe-role-page__textarea"
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  placeholder="Опишите обязанности, зону ответственности и правила работы этой должности."
                />
              </label>
              {error ? <div className="troupe-error">{error}</div> : null}
            </div>

            <div className="troupe-card troupe-role-page-card">
              <div className="troupe-team-title">Назначенные люди</div>
              <FormInlineRow className="troupe-form-row troupe-form-row--invite-email">
                <InlineTextField
                  className="troupe-invite-email-field"
                  placeholder="person@example.com"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="troupe-form-row__btn troupe-invite-card__submit"
                  disabled={addingAssignment || !emailDraft.trim()}
                  onClick={() => {
                    void handleAddAssignment();
                  }}
                >
                  {addingAssignment ? "Назначение…" : "Прикрепить"}
                </button>
              </FormInlineRow>

              {role.assignments.length === 0 ? (
                <div className="troupe-team-empty">
                  На эту должность пока никто не назначен.
                </div>
              ) : (
                <div className="troupe-role-assignment-list">
                  {role.assignments.map((assignment) => {
                    const member = assignment.teamMember;
                    const label = memberLabel(member);
                    return (
                      <div key={assignment.id} className="troupe-role-assignment">
                        <div className="troupe-actor-row">
                          <MiniAvatar
                            src={String(member.profile?.avatarUrl ?? "").trim() || null}
                            label={label || member.email}
                            size={24}
                          />
                          <div className="troupe-actor-meta">
                            <div className="troupe-actor-name">{label}</div>
                            <div className="troupe-actor-email">{member.email}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="troupe-mini-btn danger"
                          onClick={() => {
                            void handleRemoveAssignment(assignment.id);
                          }}
                        >
                          Снять
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
