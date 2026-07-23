import { Button } from "@shared/core/button/Button";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../features/auth";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import {
  studioRoleLabel,
  useAcceptStudioInviteMutation,
  usePreviewStudioInviteQuery,
} from "../../features/studio";
import "../../features/rehearsals/ui/rehearsals.css";
import "./style.css";

export function StudioInvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const { data: preview, isLoading, error } = usePreviewStudioInviteQuery(token, {
    skip: !accessToken || !token,
  });
  const [acceptInvite, { isLoading: accepting }] = useAcceptStudioInviteMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!preview?.isActive) return;
    setFormError(null);
    try {
      const studio = await acceptInvite(token).unwrap();
      navigate(`/studio/${studio.id}`, { replace: true });
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Не удалось принять приглашение",
      );
    }
  };

  if (!accessToken) {
    return (
      <div className="app-layout studio-layout">
        <div className="app-content">
          <main className="main-content">
            <div className="studio-page">
              <p className="studio-page__hint">Войдите, чтобы принять приглашение.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

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

  if (error || !preview) {
    return (
      <div className="app-layout studio-layout">
        <div className="app-content">
          <main className="main-content">
            <div className="studio-page">
              <Link className="studio-page__back" to="/studio">
                ← Студии
              </Link>
              <p className="studio-page__error">Приглашение не найдено или истекло.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const emailMismatch =
    preview.email != null && preview.emailMatches === false;

  return (
    <div className="app-layout studio-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="studio-page">
            <Link className="studio-page__back" to="/studio">
              ← Студии
            </Link>

            <RehearsalsCard fluid>
              <div className="studio-invite-preview">
                <h1 className="studio-invite-preview__title">
                  Приглашение в «{preview.studioTitle}»
                </h1>
                <p className="studio-invite-preview__meta">
                  Роль: {studioRoleLabel(preview.role)}
                  {preview.email ? ` · для ${preview.email}` : ""}
                </p>

                {!preview.isActive ? (
                  <p className="studio-page__error">
                    Приглашение недействительно или уже использовано.
                  </p>
                ) : null}

                {emailMismatch ? (
                  <p className="studio-page__error">
                    Это приглашение предназначено для другого email.
                  </p>
                ) : null}

                {formError ? (
                  <p className="studio-page__error">{formError}</p>
                ) : null}

                {preview.isActive && !emailMismatch ? (
                  <div className="studio-actions">
                    <Button
                      type="button"
                      onClick={handleAccept}
                      disabled={accepting}
                    >
                      {accepting ? "Принятие…" : "Принять приглашение"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </RehearsalsCard>
          </div>
        </main>
      </div>
    </div>
  );
}
