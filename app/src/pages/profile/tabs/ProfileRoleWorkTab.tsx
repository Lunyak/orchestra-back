import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@shared/core/button/Button";
import { useAuth } from "../../../features/auth";
import { useProject } from "../../../features/project";
import { useMyProfileQuery } from "../../../features/profile/api/profile-api";
import { useProjectRolesQuery } from "../../../features/project/api/project-api";
import { RolePlayingCard } from "../../../features/role-card/RolePlayingCard";
import { projectPath } from "../../../app/router/paths";

function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function ProfileRoleWorkTab() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const navigate = useNavigate();

  const { data: profile } = useMyProfileQuery(undefined, { skip: !accessToken });
  const {
    isFetching: rolesLoading,
    error: rolesQueryError,
    data: rolesRes,
  } = useProjectRolesQuery(projectName!, {
    skip: !accessToken || !projectName,
  });

  const roles = rolesRes?.roles ?? [];
  const rolesError = rolesQueryError
    ? String((rolesQueryError as { message?: string }).message ?? "Не удалось загрузить роли")
    : null;

  const myAssignedRoles = useMemo(() => {
    const me = normalizeEmail(profile?.email ?? "");
    if (!me) return [];
    const list = Array.isArray(roles) ? roles : [];
    return list
      .filter((r) => (r?.emails ?? []).map(normalizeEmail).includes(me))
      .slice()
      .sort((a, b) => String(a?.title ?? "").localeCompare(String(b?.title ?? ""), "ru"));
  }, [profile?.email, roles]);

  if (!accessToken) {
    return <div className="profile-tab-page profile-hint">Нужно войти, чтобы работать с ролями.</div>;
  }

  return (
    <div className="profile-tab-page">
      <div className="profile-tab-main">
        <div className="profile-tab-head">
          <div className="profile-tab-title">Рисунок роли</div>
        </div>

        <p className="profile-hint profile-tab-lead">
          Роли, назначенные на ваш email. Для каждой — тетрадь: обстоятельства, биография, сверхзадача, работа по
          сценам. Назначения — в карточке сцены на доске готовности.
        </p>

        <div className="profile-toolbar">
          <Button
            className="secondary"
            type="button"
            onClick={() => navigate(projectPath(projectName, "board"))}
            disabled={!projectName}
          >
            Открыть доску
          </Button>
        </div>

        {rolesError ? <div className="settings-invite-error">{rolesError}</div> : null}
        {rolesLoading ? <div className="profile-save-hint">Загрузка ролей…</div> : null}

        <div className="profile-panel profile-role-work-panel">
          <div className="profile-role-work-grid">
            {myAssignedRoles.length === 0 && !rolesLoading ? (
              <p className="profile-hint">
                Роли не назначены на ваш email (или профиль ещё не загружен). Назначения делаются в карточке сцены на
                доске.
              </p>
            ) : null}

            {myAssignedRoles.map((r) => (
              <div
                key={String(r.id)}
                className="profile-role-work-card"
                title="Открыть рисунок роли"
              >
                <RolePlayingCard
                  role={r}
                  accessToken={accessToken}
                  size="md"
                  onClick={() => navigate(`/role-workbook/${encodeURIComponent(String(r.id))}`)}
                />
              </div>
            ))}
          </div>
        </div>

        <p className="profile-hint profile-tab-footer">
          Проект: <strong>{projectName || "—"}</strong> · Пользователь:{" "}
          <strong>{profile?.email ?? "—"}</strong>
        </p>
      </div>
    </div>
  );
}
