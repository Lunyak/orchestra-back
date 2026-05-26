import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@shared/core/button/Button";
import { useAuth } from "../../../features/auth";
import { useProject } from "../../../features/project";
import { useMyProfileQuery } from "../../../features/profile/api/profile-api";
import { useProjectRolesQuery } from "../../../features/project/api/project-api";
import { RolePlayingCard } from "../../../features/role-card/RolePlayingCard";

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

  if (!accessToken) return <div>Нужно войти, чтобы работать с ролями.</div>;

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Рисунок роли</div>
      <div style={{ fontSize: 12, opacity: 0.75 }}>
        Здесь собраны роли, назначенные на ваш email. Для каждой роли — тетрадь с рисунком роли: обстоятельства,
        биография, сверхзадача, работа по сценам. Назначения — в карточке сцены на доске готовности.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button className="secondary" type="button" onClick={() => navigate("/board")}>
          Открыть доску
        </Button>
      </div>

      {rolesError ? <div className="settings-invite-error">{rolesError}</div> : null}
      {rolesLoading ? <div style={{ fontSize: 12, opacity: 0.7 }}>Загрузка ролей…</div> : null}

      <div className="profile-role-work-grid">
        {myAssignedRoles.length === 0 && !rolesLoading ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Роли не назначены на ваш email (или профиль ещё не загружен). Назначения делаются в карточке сцены на доске.
          </div>
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

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Проект: <b>{projectName || "—"}</b> · Пользователь: <b>{profile?.email ?? "—"}</b>
      </div>
    </div>
  );
}
