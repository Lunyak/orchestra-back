import { Button } from "@shared/core/button/Button";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
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
        displayName: String((form as any).displayName ?? ""),
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
          displayName: String((res.payload as any)?.displayName ?? ""),
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

  if (!accessToken) return <div>Нужно войти, чтобы редактировать профиль.</div>;

  return (
    <div className="profile-form">
      <p className="profile-subtitle">
        Email: <b>{profile?.email ?? "—"}</b>
      </p>
      <p style={{ fontSize: 12, opacity: 0.72, marginTop: 4, marginBottom: 12 }}>
        Имя, Telegram и ссылка на аватар сохраняются автоматически примерно через секунду после правки. При
        ошибке сохранения сообщение появится ниже.
      </p>

      <label>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Отображаемое имя</div>
        <InlineTextField
          value={String((form as any).displayName ?? "")}
          onChange={(e) =>
            dispatch(
              profileDataActions.setProfileFormField({
                key: "displayName",
                value: e.target.value,
              }),
            )
          }
          placeholder="например: Сергей"
        />
      </label>

      <div className="profile-form-row">
        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Имя</div>
          <InlineTextField
            value={String((form as any).firstName ?? "")}
            onChange={(e) =>
              dispatch(profileDataActions.setProfileFormField({ key: "firstName", value: e.target.value }))
            }
          />
        </label>
        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Фамилия</div>
          <InlineTextField
            value={String((form as any).lastName ?? "")}
            onChange={(e) =>
              dispatch(profileDataActions.setProfileFormField({ key: "lastName", value: e.target.value }))
            }
          />
        </label>
      </div>

      <div className="profile-form-row">
        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Telegram username</div>
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
        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Telegram id</div>
          <InlineTextField
            value={String((form as any).telegramId ?? "")}
            onChange={(e) =>
              dispatch(profileDataActions.setProfileFormField({ key: "telegramId", value: e.target.value }))
            }
            placeholder="123456789"
          />
        </label>
      </div>

      <label>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Avatar URL</div>
        <InlineTextField
          value={String((form as any).avatarUrl ?? "")}
          onChange={(e) =>
            dispatch(profileDataActions.setProfileFormField({ key: "avatarUrl", value: e.target.value }))
          }
          placeholder="https://..."
        />
      </label>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display: "none" }}
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
          className="primary"
          type="button"
          disabled={!accessToken || flags.avatarUploading}
          onClick={() => avatarInputRef.current?.click()}
        >
          {flags.avatarUploading ? "Загрузка…" : "Загрузить аватар"}
        </Button>
        {String((form as any).avatarUrl ?? "").trim() ? (
          <Button
            className="danger"
            type="button"
            disabled={flags.avatarUploading}
            onClick={() =>
              dispatch(profileDataActions.setProfileFormField({ key: "avatarUrl", value: "" }))
            }
            title="Удалить ссылку на аватар (файл в хранилище останется)"
          >
            Убрать аватар
          </Button>
        ) : null}
      </div>

      {String((form as any).avatarUrl ?? "").trim() ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <img
            src={String((form as any).avatarUrl ?? "").trim()}
            alt="avatar preview"
            style={{
              width: 44,
              height: 44,
              objectFit: "cover",
              border: "1px solid var(--color-border-strong)",
              background: "var(--color-bg-transparent-4)",
            }}
            referrerPolicy="no-referrer"
            onError={(e) => {
              try {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              } catch {}
            }}
          />
          <div style={{ fontSize: 12, opacity: 0.75, lineHeight: "14px" }}>
            Мини‑аватар будет показываться рядом с вашим именем в списках (труппа, роли, сессии).
          </div>
        </div>
      ) : null}

      {flags.error ? <div className="settings-invite-error">{flags.error}</div> : null}
      {flags.ok ? <div style={{ color: "var(--color-status-success-bright)", fontSize: 13 }}>{flags.ok}</div> : null}

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

      <div className="profile-danger-zone">
        <div className="profile-danger-title">Опасная зона</div>
        <div className="profile-danger-text">
          Удаление профиля очистит данные профиля (имя, ник, телефон, аватар, календарь доступности). Аккаунт
          останется, и вы сможете заполнить профиль заново.
        </div>
        <button
          type="button"
          className="profile-danger-btn"
          disabled={!accessToken || flags.deletingProfile}
          onClick={async () => {
            if (!accessToken) return;
            const okConfirm = window.confirm(
              "Удалить данные профиля? Это очистит ник/имя/телефон/аватар/календарь. Аккаунт останется.",
            );
            if (!okConfirm) return;
            dispatch(profileDataActions.clearProfileMessages());
            await dispatch(deleteProfileDataThunk({ accessToken }));
          }}
        >
          {flags.deletingProfile ? "Удаление…" : "Удалить данные профиля"}
        </button>
      </div>
    </div>
  );
}

