import { AdminSectionChrome } from "@shared/components/admin/AdminSectionChrome";
import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { projectTeamRolePath } from "../../../app/router/paths";
import { memberLabel } from "../../troupe";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { RoleAvatarEditor } from "../../role-card/RoleAvatarEditor";
import { useAuth } from "../../auth/model/auth-context";
import {
  useAddProjectTeamRoleAssignmentMutation,
  useProductionTeamQuery,
  useProjectAccessQuery,
  useProjectTeamRoleQuery,
  useRemoveProjectTeamRoleAssignmentMutation,
  useRemoveProjectTeamRoleMutation,
  useUpdateProjectTeamRoleMutation,
} from "../api/project-api";
import { useProject } from "../model/project-context";
import "../../../pages/troupe/style.css";
import "./project-production-team.css";

export function ProjectTeamRolePage() {
  const { roleId = "" } = useParams();
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const navigate = useNavigate();
  const teamPath = projectTeamRolePath(projectName);

  const [titleDraft, setTitleDraft] = useState("");
  const [parentIdDraft, setParentIdDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: role, isLoading } = useProjectTeamRoleQuery(
    { projectSlug: projectName, roleId },
    { skip: !accessToken || !projectName || !roleId },
  );
  const { data: access } = useProjectAccessQuery(projectName, {
    skip: !accessToken || !projectName,
  });
  const { data: productionTeam } = useProductionTeamQuery(projectName, {
    skip: !accessToken || !projectName,
  });
  const [updateRole, { isLoading: saving }] = useUpdateProjectTeamRoleMutation();
  const [removeRole, { isLoading: removing }] =
    useRemoveProjectTeamRoleMutation();
  const [addAssignment, { isLoading: adding }] =
    useAddProjectTeamRoleAssignmentMutation();
  const [removeAssignment] = useRemoveProjectTeamRoleAssignmentMutation();

  useEffect(() => {
    if (!role) return;
    setTitleDraft(role.title);
    setParentIdDraft(role.parentId ?? "");
    setDescriptionDraft(role.description);
  }, [role]);

  const parentOptions = [
    { value: "", label: "Верхний уровень" },
    ...(productionTeam?.projectRoles ?? [])
      .filter((item) => item.id !== role?.id)
      .map((item) => ({
        value: item.id,
        label: item.title,
      })),
  ];

  const projectId = access?.project.id ?? "";
  const canEdit = Boolean(access?.capabilities.write);

  const handleSave = async () => {
    if (!role || !projectName) return;
    setError(null);
    try {
      await updateRole({
        projectSlug: projectName,
        roleId: role.id,
        patch: {
          title: titleDraft.trim(),
          parentId: parentIdDraft || null,
          description: descriptionDraft,
        },
      }).unwrap();
    } catch {
      setError("Не удалось сохранить должность");
    }
  };

  const handleRemove = async () => {
    if (!role || !projectName) return;
    if (!window.confirm(`Удалить должность «${role.title}»?`)) return;
    try {
      await removeRole({
        projectSlug: projectName,
        roleId: role.id,
      }).unwrap();
      navigate(teamPath);
    } catch {
      setError("Не удалось удалить должность");
    }
  };

  const handleAddAssignment = async () => {
    const email = emailDraft.trim();
    if (!email || !role || !projectName) return;
    setError(null);
    try {
      await addAssignment({
        projectSlug: projectName,
        roleId: role.id,
        email,
      }).unwrap();
      setEmailDraft("");
    } catch {
      setError("Не удалось назначить участника");
    }
  };

  if (!accessToken) {
    return <div>Нужно войти.</div>;
  }

  if (isLoading) {
    return <PageLoader variant="view" label="Загружаем должность…" />;
  }

  if (!role) {
    return (
      <div className="troupe-team-empty">
        Должность не найдена.{" "}
        <Link to={teamPath}>К должностям постановки</Link>
      </div>
    );
  }

  return (
    <AdminSectionChrome activeSection="team">
    <div className="project-production-team">
      <div className="troupe-view">
        <div className="troupe-card troupe-team-card">
          <div className="troupe-team-head">
            <div>
              <Link to={teamPath} className="project-production-team__hint">
                ← Должности постановки
              </Link>
              <div className="troupe-team-title">{role.title}</div>
              <div className="troupe-team-subtitle">
                Роль только этой постановки. Штат театра не затрагивается.
              </div>
            </div>
          </div>

          {error ? <div className="troupe-error">{error}</div> : null}

          <section
            className="project-production-team__section project-production-team__avatar-row"
            aria-labelledby="role-avatar-title"
          >
            <h2
              id="role-avatar-title"
              className="project-production-team__section-title"
            >
              Фото должности
            </h2>
            {projectId ? (
              <RoleAvatarEditor
                accessToken={accessToken}
                projectId={projectId}
                role={{
                  id: role.id,
                  title: role.title,
                  avatarKey: role.avatarKey,
                }}
                canEdit={canEdit}
                busy={saving}
                variant="plain"
                onSaveAvatarKey={async (avatarKey) => {
                  await updateRole({
                    projectSlug: projectName,
                    roleId: role.id,
                    patch: { avatarKey },
                  }).unwrap();
                }}
              />
            ) : null}
          </section>

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
              options={parentOptions}
              onChange={setParentIdDraft}
              triggerClassName="troupe-role-parent-select"
              aria-label="Родительская должность"
            />
            <Button
              type="button"
              disabled={saving || !titleDraft.trim()}
              onClick={() => {
                void handleSave();
              }}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={removing}
              onClick={() => {
                void handleRemove();
              }}
            >
              Удалить
            </Button>
          </FormInlineRow>

          <label className="project-production-team__section-title">
            Инструкция
            <textarea
              className="project-production-team__textarea"
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              rows={5}
            />
          </label>

          <section
            className="project-production-team__section"
            aria-labelledby="assignees-title"
          >
            <h2
              id="assignees-title"
              className="project-production-team__section-title"
            >
              Назначения
            </h2>
            <FormInlineRow className="troupe-form-row">
              <InlineTextField
                className="troupe-title-field"
                placeholder="email@example.com"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
              />
              <Button
                type="button"
                disabled={adding || !emailDraft.trim()}
                onClick={() => {
                  void handleAddAssignment();
                }}
              >
                {adding ? "Добавление…" : "Назначить"}
              </Button>
            </FormInlineRow>
            {role.assignments.length === 0 ? (
              <div className="troupe-team-empty">Пока никто не назначен.</div>
            ) : (
              <ul className="project-production-team__assignees">
                {role.assignments.map((assignment) => {
                  const label = memberLabel(assignment.assignee);
                  return (
                    <li
                      key={assignment.id}
                      className="project-production-team__assignee"
                    >
                      <MiniAvatar
                        src={
                          String(
                            assignment.assignee.profile?.avatarUrl ?? "",
                          ).trim() || null
                        }
                        label={label || assignment.email}
                        size={28}
                      />
                      <span>{label || assignment.email}</span>
                      <button
                        type="button"
                        className="project-production-team__remove"
                        onClick={() => {
                          void removeAssignment({
                            projectSlug: projectName,
                            roleId: role.id,
                            assignmentId: assignment.id,
                          });
                        }}
                      >
                        Убрать
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
    </AdminSectionChrome>
  );
}
