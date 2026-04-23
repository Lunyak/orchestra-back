import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@shared/core/button/Button";
import { useAuth } from "../../../features/auth";
import { useProject } from "../../../features/project";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { fetchMyProfileThunk, selectMyProfile } from "../../../features/profile/model/profileDataSlice";
import {
  fetchProjectRolesThunk,
  selectProfileRolesFlags,
  selectProjectRoles,
} from "../../../features/profile/model/profileRolesSlice";

function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function ProfileRoleWorkTab() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const profile = useAppSelector(selectMyProfile);
  const roles = useAppSelector(selectProjectRoles);
  const flags = useAppSelector(selectProfileRolesFlags);

  useEffect(() => {
    if (!accessToken) return;
    dispatch(fetchMyProfileThunk({ accessToken }));
  }, [accessToken, dispatch]);

  useEffect(() => {
    if (!accessToken || !projectName) return;
    dispatch(fetchProjectRolesThunk({ accessToken, projectName }));
  }, [accessToken, dispatch, projectName]);

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
      <div style={{ fontSize: 13, fontWeight: 700 }}>Работа над ролью</div>
      <div style={{ fontSize: 12, opacity: 0.75 }}>
        Здесь собраны роли, назначенные на ваш email. Создание ролей и назначения актёров — в карточке сцены на доске
        готовности.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button className="secondary" type="button" onClick={() => navigate("/board")}>
          Открыть доску
        </Button>
      </div>

      {flags.error ? <div className="settings-invite-error">{flags.error}</div> : null}
      {flags.loading ? <div style={{ fontSize: 12, opacity: 0.7 }}>Загрузка ролей…</div> : null}

      <div style={{ display: "grid", gap: 8, maxWidth: 720 }}>
        {myAssignedRoles.length === 0 && !flags.loading ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Роли не назначены на ваш email (или профиль ещё не загружен). Назначения делаются в карточке сцены на доске.
          </div>
        ) : null}

        {myAssignedRoles.map((r) => (
          <div
            key={String(r.id)}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              padding: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{String(r.title ?? r.key ?? r.id)}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                назначено: {(r.emails ?? []).length}
              </div>
            </div>
            <Button
              className="primary"
              type="button"
              onClick={() => navigate(`/role-workbook/${encodeURIComponent(String(r.id))}`)}
            >
              Открыть
            </Button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Проект: <b>{projectName || "—"}</b> · Пользователь: <b>{profile?.email ?? "—"}</b>
      </div>
    </div>
  );
}

