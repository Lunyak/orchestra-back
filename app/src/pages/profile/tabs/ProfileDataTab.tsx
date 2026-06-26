import { Button } from "@shared/core/button/Button";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { MiniAvatar } from "@shared/core/mini-avatar/MiniAvatar";
import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../../features/auth";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import {
  deleteProfileDataThunk,
  fetchMyProfileThunk,
  profileDataActions,
  saveMyProfileThunk,
  selectMyProfile,
  selectProfileDataFlags,
  selectProfileForm,
  uploadAvatarThunk,
} from "../../../features/profile/model/profileDataSlice";

export function ProfileDataTab() {
  const { accessToken } = useAuth();
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectMyProfile);
  const form = useAppSelector(selectProfileForm);
  const flags = useAppSelector(selectProfileDataFlags);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const autoSaveBaselineRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  const mainFormSignature = useMemo(
    () =>
      JSON.stringify({
        firstName: String((form as any).firstName ?? ""),
        lastName: String((form as any).lastName ?? ""),
        telegramUsername: String((form as any).telegramUsername ?? ""),
        telegramId: String((form as any).telegramId ?? ""),
        avatarUrl: String((form as any).avatarUrl ?? ""),
      }),
    [form],
  );

  useEffect(() => {
    if (!accessToken) return;
    dispatch(fetchMyProfileThunk({ accessToken }));
  }, [accessToken, dispatch]);

  useEffect(() => {
    if (!accessToken) {
      autoSaveBaselineRef.current = null;
      if (autoSaveTimerRef.current != null) window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
      return;
    }
    if (!profile?.email) return;

    if (autoSaveBaselineRef.current == null) {
      autoSaveBaselineRef.current = mainFormSignature;
      return;
    }
    if (mainFormSignature === autoSaveBaselineRef.current) return;

    if (autoSaveTimerRef.current != null) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(async () => {
      if (!accessToken) return;
      if (flags.saving) return;
      if (autoSaveBaselineRef.current == null) return;
      if (mainFormSignature === autoSaveBaselineRef.current) return;

      const res = await dispatch(saveMyProfileThunk({ accessToken }));
      if (saveMyProfileThunk.fulfilled.match(res)) {
        autoSaveBaselineRef.current = JSON.stringify({
          firstName: String((res.payload as any)?.firstName ?? ""),
          lastName: String((res.payload as any)?.lastName ?? ""),
          telegramUsername: String((res.payload as any)?.telegramUsername ?? ""),
          telegramId: String((res.payload as any)?.telegramId ?? ""),
          avatarUrl: String((res.payload as any)?.avatarUrl ?? ""),
        });
      }
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current != null) window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    };
  }, [accessToken, dispatch, flags.saving, mainFormSignature, profile?.email]);

  const avatarUrl = String((form as any).avatarUrl ?? "").trim();
  const avatarLabel = useMemo(() => {
    const full = [String((form as any).firstName ?? "").trim(), String((form as any).lastName ?? "").trim()]
      .filter(Boolean)
      .join(" ");
    if (full) return full;
    return String(profile?.email ?? "Профиль");
  }, [form, profile?.email]);

  if (!accessToken) {
    return <div className="profile-tab-page profile-hint">Нужно войти, чтобы редактировать профиль.</div>;
  }

  return (
    <div className="profile-tab-page">
      <div className="profile-tab-main">
        <div className="profile-tab-head">
          <div className="profile-tab-title">Данные профиля</div>
          {flags.saving ? (
            <div className="profile-save-hint">Автосохранение…</div>
          ) : flags.ok ? (
            <div className="profile-save-hint profile-save-hint--ok">{flags.ok}</div>
          ) : null}
        </div>

        <p className="profile-hint profile-tab-lead">
        Имя, Telegram и аватар сохраняются автоматически примерно через секунду после правки. Email привязан к
        аккаунту и не редактируется здесь.
      </p>

      <div className="profile-panel profile-data">
        <div className="profile-data-hero">
          <MiniAvatar src={avatarUrl || null} label={avatarLabel} size={72} title={avatarLabel} />
          <div className="profile-data-hero__body">
            <div className="profile-data-hero__name">{avatarLabel}</div>
            <div className="profile-data-hero__email">{profile?.email ?? "—"}</div>
            <div className="profile-data-hero__actions">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="profile-avatar-input"
                onChange={async (e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (!f || !accessToken) return;
                  dispatch(profileDataActions.clearProfileMessages());
                  await dispatch(uploadAvatarThunk({ accessToken, file: f }));
                  try {
                    if (avatarInputRef.current) avatarInputRef.current.value = "";
                  } catch {}
                }}
              />
              <Button
                type="button"
                className="secondary"
                disabled={!accessToken || flags.avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
              >
                {flags.avatarUploading ? "Загрузка…" : "Загрузить фото"}
              </Button>
              {avatarUrl ? (
                <Button
                  className="danger"
                  type="button"
                  disabled={flags.avatarUploading}
                  onClick={() =>
                    dispatch(profileDataActions.setProfileFormField({ key: "avatarUrl", value: "" }))
                  }
                  title="Удалить ссылку на аватар (файл в хранилище останется)"
                >
                  Убрать
                </Button>
              ) : null}
            </div>
            <p className="profile-hint profile-data-hero__hint">
              Мини‑аватар показывается рядом с именем в списках труппы, ролей и сессий.
            </p>
          </div>
        </div>

        <div className="profile-data-sections profile-form">
          <section className="profile-data-section">
            <div className="profile-form-row">
              <label className="profile-field">
                <span className="profile-field__label">Имя</span>
                <InlineTextField
                  value={String((form as any).firstName ?? "")}
                  onChange={(e) =>
                    dispatch(profileDataActions.setProfileFormField({ key: "firstName", value: e.target.value }))
                  }
                />
              </label>
              <label className="profile-field">
                <span className="profile-field__label">Фамилия</span>
                <InlineTextField
                  value={String((form as any).lastName ?? "")}
                  onChange={(e) =>
                    dispatch(profileDataActions.setProfileFormField({ key: "lastName", value: e.target.value }))
                  }
                />
              </label>
            </div>
          </section>

          <section className="profile-data-section">
            <h3 className="profile-data-section__title">Telegram</h3>
            <div className="profile-form-row">
              <label className="profile-field">
                <span className="profile-field__label">Username</span>
                <InlineTextField
                  value={String((form as any).telegramUsername ?? "")}
                  onChange={(e) =>
                    dispatch(
                      profileDataActions.setProfileFormField({
                        key: "telegramUsername",
                        value: e.target.value,
                      }),
                    )
                  }
                  placeholder="@username"
                />
              </label>
              <label className="profile-field">
                <span className="profile-field__label">ID</span>
                <InlineTextField
                  value={String((form as any).telegramId ?? "")}
                  onChange={(e) =>
                    dispatch(profileDataActions.setProfileFormField({ key: "telegramId", value: e.target.value }))
                  }
                  placeholder="123456789"
                />
              </label>
            </div>
          </section>

          <details className="profile-data-advanced">
            <summary className="profile-data-advanced__summary">Ссылка на аватар (URL)</summary>
            <label className="profile-field">
              <span className="profile-field__label">Avatar URL</span>
              <InlineTextField
                value={String((form as any).avatarUrl ?? "")}
                onChange={(e) =>
                  dispatch(profileDataActions.setProfileFormField({ key: "avatarUrl", value: e.target.value }))
                }
                placeholder="https://..."
              />
            </label>
          </details>
        </div>

        {flags.error ? <div className="settings-invite-error profile-data__error">{flags.error}</div> : null}
      </div>

        <footer className="profile-data-footer">
          <div className="profile-legal-links">
            Документы:{" "}
            <a href="/terms" target="_blank" rel="noreferrer">
              Пользовательское соглашение
            </a>{" "}
            ·{" "}
            <a href="/privacy" target="_blank" rel="noreferrer">
              Политика обработки персональных данных
            </a>
          </div>
          <div className="profile-data-deletion">
            <p className="profile-hint profile-data-deletion__text">
              Вы вправе потребовать удаления персональных данных в профиле (имя, контакты, аватар, календарь
              занятости) без удаления учётной записи — после этого профиль можно заполнить заново. Порядок и
              основания — в{" "}
              <a href="/privacy" target="_blank" rel="noreferrer">
                политике обработки персональных данных
              </a>
              .
            </p>
            <button
              type="button"
              className="profile-data-deletion__action"
              disabled={!accessToken || flags.deletingProfile}
              onClick={async () => {
                if (!accessToken) return;
                const okConfirm = window.confirm(
                  "Удалить персональные данные профиля (имя, контакты, аватар, календарь занятости)? Учётная запись сохранится.",
                );
                if (!okConfirm) return;
                dispatch(profileDataActions.clearProfileMessages());
                await dispatch(deleteProfileDataThunk({ accessToken }));
              }}
            >
              {flags.deletingProfile ? "Удаление…" : "Удалить данные профиля"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
