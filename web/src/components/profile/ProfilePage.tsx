import { useEffect, useMemo, useState } from "react";
import type { MyProfile } from "../../sync/api";

export function ProfilePage({
  accessToken,
  profile,
  onProfileChange,
  onSave,
}: {
  accessToken: string | null;
  profile: MyProfile | null;
  onProfileChange: (p: MyProfile | null) => void;
  onSave: (patch: Partial<MyProfile>) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<MyProfile>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

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

  const email = profile?.email ?? "";
  const canEdit = Boolean(accessToken);

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

  return (
    <section>
      <h2>Профиль</h2>
      {!canEdit && (
        <p>Чтобы редактировать профиль, нужно войти в аккаунт.</p>
      )}

      <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Email</div>
          <input value={email || "—"} disabled style={{ width: "100%" }} />
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Отображаемое имя</div>
          <input
            value={String(form.displayName ?? "")}
            disabled={!canEdit}
            onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
            placeholder="например: Сергей"
            style={{ width: "100%" }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Имя</div>
            <input
              value={String(form.firstName ?? "")}
              disabled={!canEdit}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Фамилия</div>
            <input
              value={String(form.lastName ?? "")}
              disabled={!canEdit}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Telegram username</div>
            <input
              value={String(form.telegramUsername ?? "")}
              disabled={!canEdit}
              onChange={(e) => setForm((p) => ({ ...p, telegramUsername: e.target.value }))}
              placeholder="@username"
              style={{ width: "100%" }}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Telegram id</div>
            <input
              value={String(form.telegramId ?? "")}
              disabled={!canEdit}
              onChange={(e) => setForm((p) => ({ ...p, telegramId: e.target.value }))}
              placeholder="123456789"
              style={{ width: "100%" }}
            />
          </label>
        </div>

        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Avatar URL</div>
          <input
            value={String(form.avatarUrl ?? "")}
            disabled={!canEdit}
            onChange={(e) => setForm((p) => ({ ...p, avatarUrl: e.target.value }))}
            placeholder="https://..."
            style={{ width: "100%" }}
          />
        </label>

        {error && <div style={{ color: "crimson" }}>{error}</div>}
        {ok && <div style={{ color: "green" }}>{ok}</div>}

        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            disabled={!canEdit || saving}
            onClick={async () => {
              if (!canEdit) return;
              setSaving(true);
              setError(null);
              setOk(null);
              try {
                await onSave(normalizedPatch);
                setOk("Сохранено");
              } catch (e) {
                setError("Не удалось сохранить профиль");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
          <button
            type="button"
            disabled={!canEdit || saving}
            onClick={() => {
              onProfileChange(profile);
              setOk(null);
              setError(null);
            }}
          >
            Отменить
          </button>
        </div>
      </div>
    </section>
  );
}

