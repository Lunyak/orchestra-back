import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Button } from "@shared/core/button/Button";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  globalPaths,
  theaterOrganizationPath,
} from "../../app/router/paths";
import { useAuth } from "../../features/auth";
import {
  acceptProjectTheaterInvite,
  previewProjectTheaterInvite,
  type ProjectTheaterInvitePreview,
} from "../../sync/api/projects";
import "./project-theater-invite.css";

export function ProjectTheaterInvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [preview, setPreview] = useState<ProjectTheaterInvitePreview | null>(
    null,
  );
  const [theaterId, setTheaterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void previewProjectTheaterInvite(accessToken, token)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setTheaterId(data.theaters[0]?.id ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setPreview(null);
        setError("Приглашение не найдено или истекло.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, token]);

  const handleAccept = async () => {
    if (!accessToken || !token || !theaterId) return;
    setAccepting(true);
    setError(null);
    try {
      const result = await acceptProjectTheaterInvite(
        accessToken,
        token,
        theaterId,
      );
      navigate(theaterOrganizationPath(result.theaterId), { replace: true });
    } catch {
      setError("Не удалось принять приглашение");
    } finally {
      setAccepting(false);
    }
  };

  if (!accessToken) {
    return (
      <div className="project-theater-invite-page">
        <p>Войдите, чтобы принять приглашение.</p>
        <Link to={globalPaths.dashboard}>На главную</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="project-theater-invite-page">
        <PageLoader label="Загрузка…" />
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="project-theater-invite-page">
        <Link to={globalPaths.organizations}>← Организации</Link>
        <p className="project-theater-invite-page__error">
          {error ?? "Приглашение не найдено или истекло."}
        </p>
      </div>
    );
  }

  const hasTheaters = preview.theaters.length > 0;

  return (
    <div className="project-theater-invite-page">
      <Link to={globalPaths.organizations}>← Организации</Link>
      <h1 className="project-theater-invite-page__title">
        Подключить проект «{preview.project.name}»
      </h1>
      <p className="project-theater-invite-page__hint">
        Приглашение от {preview.invitedByEmail}. Проект останется у текущего
        владельца; театр получит партнёрскую связь.
      </p>
      {!hasTheaters ? (
        <p className="project-theater-invite-page__error">
          Нет театра, где вы администратор. Создайте театр или попросите права
          администратора.
        </p>
      ) : (
        <>
          <select
            className="native-text-input"
            value={theaterId}
            onChange={(event) => setTheaterId(event.target.value)}
            aria-label="Театр"
          >
            {preview.theaters.map((theater) => (
              <option key={theater.id} value={theater.id}>
                {theater.title}
              </option>
            ))}
          </select>
          <Button
            type="button"
            className="primary"
            onClick={() => void handleAccept()}
            disabled={!theaterId || accepting}
          >
            {accepting ? "Подключение…" : "Принять и подключить"}
          </Button>
        </>
      )}
      {error ? (
        <p className="project-theater-invite-page__error">{error}</p>
      ) : null}
    </div>
  );
}
