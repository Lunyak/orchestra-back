import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  theaterOrganizationPath,
  theaterTeamPath,
} from "../../app/router/paths";
import { TheaterSectionNav } from "../../features/organizations/ui/TheaterSectionNav";
import { memberLabel } from "../../features/troupe";
import {
  useAddTeamRoleAssignmentMutation,
  useRemoveTeamRoleMutation,
  useRemoveTeamRoleAssignmentMutation,
  useTeamRoleQuery,
  useTeamRolesQuery,
  useUpdateTeamRoleMutation,
} from "../../features/troupe/api/troupe-api";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import "../../features/organizations/ui/organizations.css";
import "./theater-team-page.css";

export function TeamRolePage() {
  const { theaterId = "", roleId = "" } = useParams();
  const teamPath = theaterTeamPath(theaterId);
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
      setError(
        e instanceof Error ? e.message : "Не удалось сохранить должность",
      );
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
      setError(
        e instanceof Error ? e.message : "Не удалось назначить человека",
      );
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
      navigate(teamPath);
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

  if (!theaterId) {
    return <Navigate to={theaterOrganizationPath()} replace />;
  }

  if (isLoading) {
    return (
      <div className="app-layout">
        <div className="app-content">
          <TheaterSectionNav theaterId={theaterId} active="team" />
          <main className="organizations-page organizations-page--detail">
            <p>Загружаем должность…</p>
          </main>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="app-layout">
        <div className="app-content">
          <TheaterSectionNav theaterId={theaterId} active="team" />
          <main className="organizations-page organizations-page--detail">
            <Link className="theater-team-page__back" to={teamPath}>
              ← Команда
            </Link>
            <p role="alert">Должность не найдена</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <div className="app-content">
        <TheaterSectionNav theaterId={theaterId} active="team" />
        <main className="organizations-page organizations-page--detail">
          <Link className="theater-team-page__back" to={teamPath}>
            ← Команда
          </Link>
          <header className="theater-team-page__header">
            <p className="organizations-page__eyebrow">Должность</p>
            <h1>{role.title}</h1>
            <span>Карточка должности театральной команды.</span>
          </header>

          <section className="theater-team-page__section">
            <div className="theater-team-page__fields">
              <label className="theater-team-page__field">
                <span className="theater-team-page__label">Название</span>
                <InlineTextField
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  maxLength={80}
                />
              </label>
              <label className="theater-team-page__field">
                <span className="theater-team-page__label">Родитель</span>
                <CustomSelect
                  value={parentIdDraft}
                  options={parentRoleOptions}
                  onChange={setParentIdDraft}
                  aria-label="Родительская должность"
                />
              </label>
              <label className="theater-team-page__field">
                <span className="theater-team-page__label">Инструкция</span>
                <textarea
                  className="theater-team-page__textarea"
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  placeholder="Опишите обязанности и зону ответственности."
                />
              </label>
              {error ? (
                <p className="theater-team-page__error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="theater-team-page__actions">
                <Button
                  type="button"
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
                  variant="danger"
                  disabled={removingRole}
                  onClick={() => {
                    void handleRemoveRole();
                  }}
                >
                  {removingRole ? "Удаление…" : "Удалить должность"}
                </Button>
              </div>
            </div>
          </section>

          <section className="theater-team-page__section">
            <header className="theater-team-page__header">
              <h2>Назначенные люди</h2>
            </header>
            <div className="theater-team-page__fields">
              <div className="theater-team-page__actions">
                <InlineTextField
                  placeholder="person@example.com"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  inputMode="email"
                  autoComplete="email"
                />
                <Button
                  type="button"
                  disabled={addingAssignment || !emailDraft.trim()}
                  onClick={() => {
                    void handleAddAssignment();
                  }}
                >
                  {addingAssignment ? "Назначение…" : "Прикрепить"}
                </Button>
              </div>
              {role.assignments.length === 0 ? (
                <p>На эту должность пока никто не назначен.</p>
              ) : (
                <ul className="theater-team-page__assignees">
                  {role.assignments.map((assignment) => {
                    const member = assignment.teamMember;
                    const label = memberLabel(member);
                    return (
                      <li
                        key={assignment.id}
                        className="theater-team-page__assignee"
                      >
                        <MiniAvatar
                          src={
                            String(member.profile?.avatarUrl ?? "").trim() ||
                            null
                          }
                          label={label || member.email}
                          size={24}
                        />
                        <div className="theater-team-page__assignee-meta">
                          <div className="theater-team-page__assignee-name">
                            {label}
                          </div>
                          <div className="theater-team-page__assignee-email">
                            {member.email}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="theater-team-page__assignee-remove"
                          onClick={() => {
                            void handleRemoveAssignment(assignment.id);
                          }}
                        >
                          Снять
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
