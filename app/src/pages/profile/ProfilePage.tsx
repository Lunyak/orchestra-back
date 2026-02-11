import { useEffect, useMemo, useState } from "react";
import { getMyProfile, updateMyProfile, type MyProfile } from "../../sync/api";
import { useAuth } from "../../features/auth";

export function ProfilePage() {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [form, setForm] = useState<Partial<MyProfile>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getMyProfile(accessToken)
      .then((p) => setProfile(p))
      .catch(() => setProfile(null));
  }, [accessToken]);

  useEffect(() => {
    setForm({
      displayName: profile?.displayName ?? "",
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      telegramUsername: profile?.telegramUsername ?? "",
      telegramId: profile?.telegramId ?? "",
      avatarUrl: profile?.avatarUrl ?? "",
    });
  }, [profile]);

  const normalizedPatch = useMemo(() => {
    const t = (v: unknown) => String(v ?? "").trim();
    return {
      displayName: t(form.displayName),
      firstName: t(form.firstName),
      lastName: t(form.lastName),
      telegramUsername: t(form.telegramUsername),
      telegramId: t(form.telegramId),
      avatarUrl: t(form.avatarUrl),
    } as Partial<MyProfile>;
  }, [form]);

  if (!accessToken) return <div>Нужно войти, чтобы редактировать профиль.</div>;

  return (
    <div className="settings-view">
      <h2>Профиль</h2>
      <p style={{ opacity: 0.8, fontSize: 13, marginTop: 6 }}>
        Email: <b>{profile?.email ?? "—"}</b>
      </p>

      <div style={{ display: "grid", gap: 12, maxWidth: 520, marginTop: 12 }}>
        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Отображаемое имя</div>
          <input
            className="settings-invite-input"
            value={String(form.displayName ?? "")}
            onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
            placeholder="например: Сергей"
            style={{ maxWidth: "unset" }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Имя</div>
            <input
              className="settings-invite-input"
              value={String(form.firstName ?? "")}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              style={{ maxWidth: "unset" }}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Фамилия</div>
            <input
              className="settings-invite-input"
              value={String(form.lastName ?? "")}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              style={{ maxWidth: "unset" }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Telegram username</div>
            <input
              className="settings-invite-input"
              value={String(form.telegramUsername ?? "")}
              onChange={(e) =>
                setForm((p) => ({ ...p, telegramUsername: e.target.value }))
              }
              placeholder="@username"
              style={{ maxWidth: "unset" }}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Telegram id</div>
            <input
              className="settings-invite-input"
              value={String(form.telegramId ?? "")}
              onChange={(e) => setForm((p) => ({ ...p, telegramId: e.target.value }))}
              placeholder="123456789"
              style={{ maxWidth: "unset" }}
            />
          </label>
        </div>

        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Avatar URL</div>
          <input
            className="settings-invite-input"
            value={String(form.avatarUrl ?? "")}
            onChange={(e) => setForm((p) => ({ ...p, avatarUrl: e.target.value }))}
            placeholder="https://..."
            style={{ maxWidth: "unset" }}
          />
        </label>

        {error && <div className="settings-invite-error">{error}</div>}
        {ok && <div style={{ color: "#7ee787", fontSize: 13 }}>{ok}</div>}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={async () => {
              if (!accessToken) return;
              setSaving(true);
              setError(null);
              setOk(null);
              try {
                const next = await updateMyProfile(accessToken, normalizedPatch);
                setProfile(next);
                setOk("Сохранено");
              } catch {
                setError("Не удалось сохранить профиль");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

