import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import {
  adminLogin,
  adminLogout,
  getApiBaseUrl,
  getPlans,
  getProjects,
  getUsers,
  isAdminLoggedIn,
  setProjectDeleted,
  setUserSubscription,
  updatePlan,
  uploadSiteMedia,
  type PlanRow,
  type ProjectRow,
  type UserRow
} from "./api";

const WEB_LOCAL = (import.meta as any).env?.VITE_LINK_WEB_LOCAL ?? "http://localhost:5173";
const WEB_SERVER = (import.meta as any).env?.VITE_LINK_WEB_SERVER ?? "http://213.226.126.196";
const LINK_MINIO = (import.meta as any).env?.VITE_LINK_MINIO ?? "http://213.226.126.196:9001";
const LINK_DOZZLE = (import.meta as any).env?.VITE_LINK_DOZZLE ?? "http://213.226.126.196:9999";

function ServicesPage() {
  const apiBase = getApiBaseUrl();
  const links = [
    { label: "Локальный фронт (веб)", href: WEB_LOCAL, desc: "Vite dev-сервер" },
    { label: "Фронт на сервере (веб)", href: WEB_SERVER, desc: "Продакшен SPA" },
    { label: "API (бэкенд)", href: apiBase, desc: "NestJS, sync, auth" },
    { label: "Файлы (раздача)", href: `${apiBase}/files/play`, desc: "GET /files/play/:key" },
    { label: "Файлы (стрим с авторизацией)", href: `${apiBase}/files/stream`, desc: "GET /files/stream?key=..." },
    { label: "MinIO (консоль)", href: LINK_MINIO, desc: "S3-хранилище" },
    { label: "Dozzle", href: LINK_DOZZLE, desc: "Просмотр логов контейнеров" },
  ];
  return (
    <div className="admin-page">
      <h1>Сервисы</h1>
      <ul className="admin-links">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} target="_blank" rel="noopener noreferrer" className="admin-link">
              <span className="admin-link-desc">{l.label}</span>
              <span className="admin-link-url">{l.href}</span>
              {l.desc && <small>{l.desc}</small>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin?: () => void }) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const ok = await adminLogin(secret);
    if (ok) {
      onLogin?.();
      navigate("/", { replace: true });
    } else setError("Неверный ключ доступа");
  };

  return (
    <div className="admin-login">
      <h1>Админка Orchestra</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Ключ доступа (ADMIN_SECRET)"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoFocus
        />
        <button type="submit">Войти</button>
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
}

function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [u, p] = await Promise.all([getUsers(), getPlans()]);
      setUsers(u);
      setPlans(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSubscriptionChange = async (userId: string, subscriptionId: string | null) => {
    try {
      await setUserSubscription(userId, subscriptionId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  };

  if (loading) return <div className="admin-page">Загрузка…</div>;
  if (error) return <div className="admin-page">Ошибка: {error}</div>;

  return (
    <div className="admin-page">
      <h1>Пользователи</h1>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Создан</th>
            <th>Проектов</th>
            <th>Подписка</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{new Date(u.createdAt).toLocaleDateString("ru")}</td>
              <td>{u._count.projectsOwned}</td>
              <td>
                <select
                  value={u.subscriptionId ?? ""}
                  onChange={(e) =>
                    onSubscriptionChange(u.id, e.target.value || null)
                  }
                >
                  <option value="">— нет —</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (проектов: {p.maxProjects ?? "∞"})
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const p = await getProjects();
      setProjects(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDeleted = async (project: ProjectRow) => {
    const deleted = !!project.deletedAt;
    try {
      await setProjectDeleted(project.id, !deleted);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  if (loading) return <div className="admin-page">Загрузка…</div>;
  if (error) return <div className="admin-page">Ошибка: {error}</div>;

  return (
    <div className="admin-page">
      <h1>Проекты</h1>
      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Slug</th>
            <th>Владелец</th>
            <th>Создан</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className={p.deletedAt ? "deleted" : ""}>
              <td>{p.name}</td>
              <td>{p.slug}</td>
              <td>{p.owner.email}</td>
              <td>{new Date(p.createdAt).toLocaleDateString("ru")}</td>
              <td>
                <button
                  type="button"
                  className={`small ${p.deletedAt ? "" : "danger"}`}
                  onClick={() => toggleDeleted(p)}
                >
                  {p.deletedAt ? "Восстановить" : "Удалить"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlansPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [draft, setDraft] = useState<Record<string, { maxProjects: string; maxCollaborators: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setOk("");
    try {
      const p = await getPlans();
      setPlans(p);
      const next: Record<string, { maxProjects: string; maxCollaborators: string }> = {};
      for (const it of p) {
        next[it.id] = {
          maxProjects: it.maxProjects == null ? "" : String(it.maxProjects),
          maxCollaborators:
            it.maxCollaboratorsPerProject == null ? "" : String(it.maxCollaboratorsPerProject),
        };
      }
      setDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const parseLimit = (s: string): number | null => {
    const t = (s ?? "").trim();
    if (!t) return null; // empty => unlimited
    const n = Number(t);
    if (!Number.isFinite(n)) throw new Error("Должно быть число или пусто (∞)");
    return Math.trunc(n);
  };

  const save = async (planId: string) => {
    setError("");
    setOk("");
    try {
      const row = draft[planId];
      if (!row) return;
      const maxProjects = parseLimit(row.maxProjects);
      const maxCollaboratorsPerProject = parseLimit(row.maxCollaborators);
      await updatePlan(planId, { maxProjects, maxCollaboratorsPerProject });
      setOk("Сохранено");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  };

  if (loading) return <div className="admin-page">Загрузка…</div>;
  if (error) return <div className="admin-page">Ошибка: {error}</div>;

  return (
    <div className="admin-page">
      <h1>Тарифы</h1>
      {ok && <div style={{ marginBottom: 10, color: "#0a7a2f" }}>{ok}</div>}
      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Проектов (пусто = ∞)</th>
            <th>Участников (пусто = ∞)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => {
            const d = draft[p.id] ?? { maxProjects: "", maxCollaborators: "" };
            return (
              <tr key={p.id}>
                <td><b>{p.name}</b></td>
                <td>
                  <input
                    value={d.maxProjects}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [p.id]: { ...(prev[p.id] ?? d), maxProjects: e.target.value },
                      }))
                    }
                    placeholder="∞"
                    inputMode="numeric"
                  />
                </td>
                <td>
                  <input
                    value={d.maxCollaborators}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [p.id]: { ...(prev[p.id] ?? d), maxCollaborators: e.target.value },
                      }))
                    }
                    placeholder="∞"
                    inputMode="numeric"
                  />
                </td>
                <td>
                  <button type="button" className="small" onClick={() => save(p.id)}>
                    Сохранить
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ marginTop: 12 }}>
        Для <b>free</b> поставь участников <code>0</code>, чтобы запретить коллаборацию (или оставь
        лимит и включай/выключай фичи позже).
      </p>
    </div>
  );
}

function SiteMediaPage() {
  const [pathValue, setPathValue] = useState("photos/vassa/0.jpg");
  const [prefixValue, setPrefixValue] = useState("site");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ key: string; url: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!file) {
      setError("Выбери файл");
      return;
    }
    const p = pathValue.trim();
    if (!p) {
      setError("Укажи path (например photos/vassa/0.jpg)");
      return;
    }
    setLoading(true);
    try {
      const out = await uploadSiteMedia({
        file,
        path: p,
        prefix: prefixValue.trim() || "site",
      });
      setResult(out);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const referencePath = (() => {
    const p = pathValue.trim().replace(/^\/+/, "");
    return p ? `/${p}` : "";
  })();

  return (
    <div className="admin-page">
      <h1>Медиа сайта</h1>
      <p>
        Загружай картинки в MinIO/S3 и используй на сайте как путь из public, например{" "}
        <code>{referencePath || "/photos/vassa/0.jpg"}</code>.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 720 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Path (относительно site/)</span>
          <input
            value={pathValue}
            onChange={(e) => setPathValue(e.target.value)}
            placeholder="photos/vassa/0.jpg"
            spellCheck={false}
          />
          <small>Будет сохранено как: <code>{`site/${pathValue.trim().replace(/^\/+/, "")}`}</code></small>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Prefix (опционально)</span>
          <input
            value={prefixValue}
            onChange={(e) => setPrefixValue(e.target.value)}
            placeholder="site"
            spellCheck={false}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Файл</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Загрузка…" : "Загрузить"}
        </button>
      </form>

      {error && <div style={{ marginTop: 12, color: "#b00020" }}>Ошибка: {error}</div>}

      {result && (
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          <div>
            key: <code>{result.key}</code>
          </div>
          <div>
            url:{" "}
            <a href={result.url} target="_blank" rel="noopener noreferrer">
              {result.url}
            </a>
          </div>
          <div>
            На сайте используй: <code>{referencePath}</code>
          </div>
        </div>
      )}
    </div>
  );
}

type SiteCastItem = { role: string; actor: string };
type SiteEvent = {
  slug: string;
  soon: boolean;
  name: string;
  subtitle?: string;
  old?: string;
  anonse?: string;
  date?: string;
  cardImage: string;
  eventPageBg?: string;
  type?: string;
  colorBackground?: number;
  photos?: string[];
  cast?: SiteCastItem[];
  ticketsCloudEventId?: string;
  ticketsCloudToken?: string;
};

type SiteEventsContent = {
  version?: number;
  updatedAt?: string;
  events: SiteEvent[];
};

function SiteContentPage() {
  const [raw, setRaw] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState<string>("");
  const [loadedMeta, setLoadedMeta] = useState<{ version: number | null; updatedAt: string | null } | null>(null);

  const url = "/minio/orchestra-media/site/content/events.json";

  const load = async () => {
    setError("");
    setOk("");
    setLoading(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 404) {
        // First deploy: the file might not exist in MinIO yet.
        setRaw('{\n  "events": []\n}\n');
        setLoadedMeta(null);
        setOk("Файл не найден (ещё не опубликован). Отредактируй и нажми «Опубликовать» — файл будет создан.");
        return;
      }
      if (!res.ok) throw new Error(`Не удалось загрузить: ${res.status}`);
      const text = await res.text();
      setRaw(text);
      try {
        const parsed = JSON.parse(text) as SiteEventsContent;
        const v = typeof parsed?.version === "number" ? parsed.version : null;
        const u = typeof parsed?.updatedAt === "string" ? parsed.updatedAt : null;
        setLoadedMeta({ version: v, updatedAt: u });
      } catch {
        setLoadedMeta(null);
      }
      setOk("Загружено");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-load existing JSON on page open to avoid accidental overwrites.
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish = async () => {
    setError("");
    setOk("");
    setLoading(true);
    try {
      // Safety: if the file changed since last load, warn instead of overwriting.
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const currentText = await res.text();
          const current = JSON.parse(currentText) as SiteEventsContent;
          const currentVersion = typeof current?.version === "number" ? current.version : null;
          const currentUpdatedAt = typeof current?.updatedAt === "string" ? current.updatedAt : null;
          if (
            loadedMeta &&
            (currentVersion !== loadedMeta.version || currentUpdatedAt !== loadedMeta.updatedAt)
          ) {
            throw new Error(
              "Файл events.json изменился с момента загрузки. Нажми «Загрузить текущий JSON» и повтори правки, чтобы не перетереть чужие изменения."
            );
          }
        }
      } catch (e3) {
        // If it's our own warning - rethrow; otherwise ignore fetch errors and let publish attempt.
        if (e3 instanceof Error && e3.message.includes("изменился с момента загрузки")) throw e3;
      }

      const parsed = JSON.parse(raw) as SiteEventsContent;
      if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).events)) {
        throw new Error("JSON должен быть формата { events: [...] }");
      }
      parsed.updatedAt = new Date().toISOString();
      parsed.version = (parsed.version ?? 0) + 1;
      const normalized = JSON.stringify(parsed, null, 2);
      setRaw(normalized);
      setLoadedMeta({
        version: typeof parsed.version === "number" ? parsed.version : null,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      });

      const file = new File([normalized], "events.json", { type: "application/json" });
      const out = await uploadSiteMedia({
        file,
        path: "content/events.json",
        prefix: "site",
      });
      setOk(`Опубликовано: ${out.url}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка публикации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <h1>Контент сайта</h1>
      <p>
        Редактируй спектакли, фото и cast (для <code>event-page__cast</code>) в JSON и публикуй в{" "}
        <code>site/content/events.json</code>.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "…" : "Загрузить текущий JSON"}
        </button>
        <button type="button" onClick={publish} disabled={loading || !raw.trim()}>
          {loading ? "…" : "Опубликовать"}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer">
          Открыть файл
        </a>
      </div>

      {loadedMeta && (
        <div style={{ marginTop: 10, opacity: 0.85 }}>
          Загружено: version={loadedMeta.version ?? "—"}, updatedAt={loadedMeta.updatedAt ?? "—"}
        </div>
      )}

      {error && <div style={{ marginTop: 12, color: "#b00020" }}>Ошибка: {error}</div>}
      {ok && <div style={{ marginTop: 12, color: "#0a7a2f" }}>{ok}</div>}

      <div style={{ marginTop: 12 }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={`{\n  "events": [\n    {\n      "slug": "заклятие",\n      "name": "Заклятие",\n      "soon": false,\n      "cardImage": "afisha.jpg",\n      "eventPageBg": "/photos/fools/0.jpg",\n      "photos": ["/photos/fools/0.jpg"],\n      "cast": [{ "role": "Леон", "actor": "..." }]\n    }\n  ]\n}\n`}
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: 520,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
          }}
        />
      </div>
    </div>
  );
}

function SiteEventsCrudPage() {
  const url = "/minio/orchestra-media/site/content/events.json";
  const [content, setContent] = useState<SiteEventsContent>({ events: [] });
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loadedMeta, setLoadedMeta] = useState<{ version: number | null; updatedAt: string | null } | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [photosFiles, setPhotosFiles] = useState<File[]>([]);

  const load = async () => {
    setError("");
    setOk("");
    setLoading(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 404) {
        setContent({ events: [] });
        setLoadedMeta(null);
        setSelectedSlug(null);
        setOk("events.json не найден (ещё не опубликован). Нажми «Создать спектакль», затем «Опубликовать» — файл появится.");
        return;
      }
      if (!res.ok) throw new Error(`Не удалось загрузить: ${res.status}`);
      const text = await res.text();
      const parsed = JSON.parse(text) as SiteEventsContent;
      if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).events)) {
        throw new Error("events.json должен быть формата { events: [...] }");
      }
      setContent(parsed);
      setLoadedMeta({
        version: typeof parsed.version === "number" ? parsed.version : null,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      });
      const first = (parsed.events ?? [])[0]?.slug;
      setSelectedSlug((prev) => prev ?? (typeof first === "string" ? first : null));
      setOk("Загружено");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => {
    return (content.events ?? []).find((e) => e.slug === selectedSlug) ?? null;
  }, [content.events, selectedSlug]);

  const updateSelected = (patch: Partial<SiteEvent>) => {
    if (!selectedSlug) return;
    setContent((prev) => ({
      ...prev,
      events: (prev.events ?? []).map((e) => (e.slug === selectedSlug ? { ...e, ...patch } : e)),
    }));
  };

  const normalizePathSegment = (value: string): string => {
    const v = String(value ?? "").trim();
    // keep letters/digits (incl. cyrillic), dash/underscore/dot, replace spaces with '-'
    const s = v
      .replace(/[\\/]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/[^0-9A-Za-zА-Яа-яЁё._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    return s || "file";
  };

  const extFromName = (name: string): string => {
    const m = String(name ?? "").toLowerCase().match(/\.([a-z0-9]{1,8})$/);
    const ext = m ? m[1] : "";
    if (!ext) return "jpg";
    if (["jpg", "jpeg", "png", "webp", "gif", "svg", "avif", "heic"].includes(ext)) return ext;
    return "jpg";
  };

  const uploadAndSetField = async (file: File, kind: "cover" | "bg") => {
    if (!selected) throw new Error("Не выбран спектакль");
    const slugSeg = normalizePathSegment(selected.slug);
    const ext = extFromName(file.name);
    const path =
      kind === "cover" ? `covers/${slugSeg}.${ext}` : `bg/${slugSeg}.${ext}`;
    const out = await uploadSiteMedia({ file, path, prefix: "site" });
    const ref = `/${path}`;
    if (kind === "cover") updateSelected({ cardImage: ref });
    else updateSelected({ eventPageBg: ref });
    setOk(`Загружено: ${out.url}`);
  };

  const uploadAndAppendPhotos = async (files: File[]) => {
    if (!selected) throw new Error("Не выбран спектакль");
    const slugSeg = normalizePathSegment(selected.slug);
    const ts = Date.now();
    const nextPhotos = [...(selected.photos ?? [])];
    for (let i = 0; i < files.length; i += 1) {
      const f = files[i];
      const ext = extFromName(f.name);
      const baseName = normalizePathSegment(f.name.replace(/\.[^.]+$/, ""));
      const path = `photos/${slugSeg}/${ts}-${i + 1}-${baseName}.${ext}`;
      const out = await uploadSiteMedia({ file: f, path, prefix: "site" });
      nextPhotos.push(`/${path}`);
      setOk(`Загружено: ${out.url}`);
    }
    updateSelected({ photos: nextPhotos });
  };

  const createNew = () => {
    const baseSlug = "новый-спектакль";
    const existing = new Set((content.events ?? []).map((e) => e.slug));
    let slug = baseSlug;
    for (let i = 2; i < 2000; i += 1) {
      if (!existing.has(slug)) break;
      slug = `${baseSlug}-${i}`;
    }
    const ev: SiteEvent = {
      slug,
      soon: true,
      name: "Новый спектакль",
      subtitle: "",
      old: "",
      type: "",
      anonse: "",
      date: "",
      cardImage: "afisha.jpg",
      eventPageBg: "",
      photos: [],
      cast: [],
      colorBackground: 0x6b0f1a,
      ticketsCloudEventId: "",
      ticketsCloudToken: "",
    };
    setContent((prev) => ({ ...prev, events: [ev, ...(prev.events ?? [])] }));
    setSelectedSlug(slug);
  };

  const removeSelected = () => {
    if (!selectedSlug) return;
    if (!confirm(`Удалить спектакль "${selectedSlug}"?`)) return;
    setContent((prev) => ({ ...prev, events: (prev.events ?? []).filter((e) => e.slug !== selectedSlug) }));
    setSelectedSlug(null);
  };

  const publish = async () => {
    setError("");
    setOk("");
    setLoading(true);
    try {
      // Safety check (same as in SiteContentPage)
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const currentText = await res.text();
          const current = JSON.parse(currentText) as SiteEventsContent;
          const currentVersion = typeof current?.version === "number" ? current.version : null;
          const currentUpdatedAt = typeof current?.updatedAt === "string" ? current.updatedAt : null;
          if (
            loadedMeta &&
            (currentVersion !== loadedMeta.version || currentUpdatedAt !== loadedMeta.updatedAt)
          ) {
            throw new Error(
              "Файл events.json изменился с момента загрузки. Нажми «Загрузить» и повтори правки, чтобы не перетереть чужие изменения."
            );
          }
        }
      } catch (e3) {
        if (e3 instanceof Error && e3.message.includes("изменился с момента загрузки")) throw e3;
      }

      // Validate
      for (const ev of content.events ?? []) {
        if (!ev.slug?.trim()) throw new Error("slug обязателен для каждого спектакля");
        if (!ev.name?.trim()) throw new Error(`name обязателен (slug=${ev.slug})`);
        if (!ev.cardImage?.trim()) throw new Error(`cardImage обязателен (slug=${ev.slug})`);
      }

      const next: SiteEventsContent = {
        ...content,
        updatedAt: new Date().toISOString(),
        version: (content.version ?? 0) + 1,
        events: content.events ?? [],
      };
      setContent(next);
      setLoadedMeta({
        version: typeof next.version === "number" ? next.version : null,
        updatedAt: typeof next.updatedAt === "string" ? next.updatedAt : null,
      });

      const json = JSON.stringify(next, null, 2);
      const file = new File([json], "events.json", { type: "application/json" });
      const out = await uploadSiteMedia({ file, path: "content/events.json", prefix: "site" });
      setOk(`Опубликовано: ${out.url}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка публикации");
    } finally {
      setLoading(false);
    }
  };

  const castText = (selected?.cast ?? [])
    .map((c: SiteCastItem) => `${c.role} — ${c.actor}`)
    .join("\n");
  const photosText = (selected?.photos ?? []).join("\n");

  return (
    <div className="admin-page">
      <h1>Спектакли</h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "…" : "Загрузить"}
        </button>
        <button type="button" onClick={publish} disabled={loading}>
          {loading ? "…" : "Опубликовать"}
        </button>
        <button type="button" onClick={createNew} disabled={loading}>
          + Создать
        </button>
        <button type="button" onClick={removeSelected} disabled={loading || !selectedSlug} className="small danger">
          Удалить
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer">
          Открыть JSON
        </a>
      </div>

      {loadedMeta && (
        <div style={{ marginBottom: 10, opacity: 0.85 }}>
          version={loadedMeta.version ?? "—"}, updatedAt={loadedMeta.updatedAt ?? "—"}
        </div>
      )}
      {error && <div style={{ marginBottom: 10, color: "#b00020" }}>Ошибка: {error}</div>}
      {ok && <div style={{ marginBottom: 10, color: "#0a7a2f" }}>{ok}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Список</div>
          <div style={{ display: "grid", gap: 6 }}>
            {(content.events ?? []).map((e) => (
              <button
                key={e.slug}
                type="button"
                onClick={() => setSelectedSlug(e.slug)}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: e.slug === selectedSlug ? "rgba(255,255,255,0.08)" : "transparent",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700 }}>{e.name}</div>
                <div style={{ opacity: 0.8, fontSize: 12 }}>{e.slug}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 12 }}>
          {!selected ? (
            <div style={{ opacity: 0.8 }}>Выбери спектакль слева или нажми “Создать”.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Slug (URL: /события/&lt;slug&gt;)</span>
                  <input
                    value={selected.slug}
                    onChange={(e) => {
                      const next = e.target.value;
                      // Change slug with uniqueness check
                      const exists = (content.events ?? []).some((x) => x.slug === next && x !== selected);
                      if (exists) return;
                      setContent((prev) => ({
                        ...prev,
                        events: (prev.events ?? []).map((x) => (x.slug === selected.slug ? { ...x, slug: next } : x)),
                      }));
                      setSelectedSlug(next);
                    }}
                    spellCheck={false}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Название</span>
                  <input value={selected.name} onChange={(e) => updateSelected({ name: e.target.value })} />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Скоро</span>
                  <select value={selected.soon ? "yes" : "no"} onChange={(e) => updateSelected({ soon: e.target.value === "yes" })}>
                    <option value="no">нет</option>
                    <option value="yes">да</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Дата</span>
                  <input value={selected.date ?? ""} onChange={(e) => updateSelected({ date: e.target.value })} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Возраст</span>
                  <input value={selected.old ?? ""} onChange={(e) => updateSelected({ old: e.target.value })} />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>TicketCloud eventId</span>
                  <input
                    value={selected.ticketsCloudEventId ?? ""}
                    onChange={(e) => updateSelected({ ticketsCloudEventId: e.target.value })}
                    placeholder="например 123456"
                    spellCheck={false}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>TicketCloud token</span>
                  <input
                    value={selected.ticketsCloudToken ?? ""}
                    onChange={(e) => updateSelected({ ticketsCloudToken: e.target.value })}
                    placeholder="например abcd1234..."
                    spellCheck={false}
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Лицевое изображение (cardImage)</span>
                <input
                  value={selected.cardImage}
                  onChange={(e) => updateSelected({ cardImage: e.target.value })}
                  placeholder="afisha.jpg или /photos/..."
                  spellCheck={false}
                />
              </label>

              <div style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, opacity: 0.9 }}>Загрузить обложку в MinIO и вставить в cardImage</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className="small"
                    disabled={loading || !coverFile}
                    onClick={async () => {
                      if (!coverFile) return;
                      setLoading(true);
                      setError("");
                      setOk("");
                      try {
                        await uploadAndSetField(coverFile, "cover");
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Ошибка загрузки");
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Загрузить обложку
                  </button>
                </div>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Фон страницы спектакля (eventPageBg)</span>
                <input
                  value={selected.eventPageBg ?? ""}
                  onChange={(e) => updateSelected({ eventPageBg: e.target.value })}
                  placeholder="/photos/..."
                  spellCheck={false}
                />
              </label>

              <div style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, opacity: 0.9 }}>Загрузить фон в MinIO и вставить в eventPageBg</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setBgFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className="small"
                    disabled={loading || !bgFile}
                    onClick={async () => {
                      if (!bgFile) return;
                      setLoading(true);
                      setError("");
                      setOk("");
                      try {
                        await uploadAndSetField(bgFile, "bg");
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Ошибка загрузки");
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Загрузить фон
                  </button>
                </div>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Описание (anonse)</span>
                <textarea value={selected.anonse ?? ""} onChange={(e) => updateSelected({ anonse: e.target.value })} />
              </label>

              <div style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, opacity: 0.9 }}>Загрузить фото (добавятся в список photos)</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setPhotosFiles(Array.from(e.target.files ?? []))}
                  />
                  <button
                    type="button"
                    className="small"
                    disabled={loading || photosFiles.length === 0}
                    onClick={async () => {
                      if (photosFiles.length === 0) return;
                      setLoading(true);
                      setError("");
                      setOk("");
                      try {
                        await uploadAndAppendPhotos(photosFiles);
                        setPhotosFiles([]);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Ошибка загрузки");
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Загрузить фото
                  </button>
                </div>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Фото (по одному пути на строку)</span>
                <textarea
                  value={photosText}
                  onChange={(e) => updateSelected({ photos: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                  spellCheck={false}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Cast (по строке: Роль — Актёр)</span>
                <textarea
                  value={castText}
                  onChange={(e) => {
                    const lines = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                    const cast = lines
                      .map((line) => {
                        const parts = line.split("—");
                        if (parts.length < 2) return null;
                        const role = parts[0].trim();
                        const actor = parts.slice(1).join("—").trim();
                        if (!role || !actor) return null;
                        return { role, actor };
                      })
                      .filter(Boolean) as SiteCastItem[];
                    updateSelected({ cast });
                  }}
                  spellCheck={false}
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SiteMarqueePage() {
  const url = "/minio/orchestra-media/site/content/marquee.json";
  const [itemsText, setItemsText] = useState("");
  const [duration, setDuration] = useState<string>("22");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loadedMeta, setLoadedMeta] = useState<{ version: number | null; updatedAt: string | null } | null>(null);

  const load = async () => {
    setError("");
    setOk("");
    setLoading(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 404) {
        setItemsText("");
        setDuration("22");
        setLoadedMeta(null);
        setOk("Файл marquee.json не найден (ещё не опубликован). Заполни и нажми «Опубликовать» — файл будет создан.");
        return;
      }
      if (!res.ok) throw new Error(`Не удалось загрузить: ${res.status}`);
      const text = await res.text();
      const parsed = JSON.parse(text) as { items?: any; duration?: any; version?: any; updatedAt?: any };
      const items = Array.isArray(parsed?.items) ? parsed.items.filter((x: any) => typeof x === "string") : [];
      setItemsText(items.join("\n"));
      setDuration(parsed?.duration != null ? String(parsed.duration) : "22");
      setLoadedMeta({
        version: typeof parsed?.version === "number" ? parsed.version : null,
        updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : null,
      });
      setOk("Загружено");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish = async () => {
    setError("");
    setOk("");
    setLoading(true);
    try {
      // basic overwrite protection
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const currentText = await res.text();
          const current = JSON.parse(currentText) as any;
          const currentVersion = typeof current?.version === "number" ? current.version : null;
          const currentUpdatedAt = typeof current?.updatedAt === "string" ? current.updatedAt : null;
          if (
            loadedMeta &&
            (currentVersion !== loadedMeta.version || currentUpdatedAt !== loadedMeta.updatedAt)
          ) {
            throw new Error(
              "Файл marquee.json изменился с момента загрузки. Нажми «Загрузить» и повтори правки, чтобы не перетереть чужие изменения."
            );
          }
        }
      } catch (e3) {
        if (e3 instanceof Error && e3.message.includes("изменился с момента загрузки")) throw e3;
      }

      const items = itemsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const dur = Number(duration);
      const durSafe =
        Number.isFinite(dur) && dur > 3 && dur < 600 ? Math.round(dur * 10) / 10 : 22;

      const next = {
        version: (loadedMeta?.version ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        items,
        duration: durSafe,
      };

      const json = JSON.stringify(next, null, 2);
      const file = new File([json], "marquee.json", { type: "application/json" });
      const out = await uploadSiteMedia({ file, path: "content/marquee.json", prefix: "site" });
      setLoadedMeta({ version: next.version, updatedAt: next.updatedAt });
      setOk(`Опубликовано: ${out.url}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка публикации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <h1>Бегущая строка</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "…" : "Загрузить"}
        </button>
        <button type="button" onClick={publish} disabled={loading}>
          {loading ? "…" : "Опубликовать"}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer">
          Открыть JSON
        </a>
      </div>

      {loadedMeta && (
        <div style={{ marginBottom: 10, opacity: 0.85 }}>
          version={loadedMeta.version ?? "—"}, updatedAt={loadedMeta.updatedAt ?? "—"}
        </div>
      )}
      {error && <div style={{ marginBottom: 10, color: "#b00020" }}>Ошибка: {error}</div>}
      {ok && <div style={{ marginBottom: 10, color: "#0a7a2f" }}>{ok}</div>}

      <label style={{ display: "grid", gap: 6, maxWidth: 260, marginBottom: 10 }}>
        <span>Длительность (сек)</span>
        <input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="decimal" />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Строки (каждая строка — отдельный элемент)</span>
        <textarea
          value={itemsText}
          onChange={(e) => setItemsText(e.target.value)}
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: 260,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
          }}
        />
      </label>
    </div>
  );
}

function Layout({
  children,
  onLogout,
}: {
  children: React.ReactNode;
  onLogout: () => void;
}) {
  const navigate = useNavigate();

  const logout = () => {
    adminLogout();
    onLogout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <nav className="admin-nav">
        <NavLink to="/" end>
          Пользователи
        </NavLink>
        <NavLink to="/plans">Тарифы</NavLink>
        <NavLink to="/projects">Проекты</NavLink>
        <NavLink to="/site-events">Спектакли</NavLink>
        <NavLink to="/site-marquee">Бегущая строка</NavLink>
        <NavLink to="/site-media">Медиа сайта</NavLink>
        <NavLink to="/site-content">Контент сайта</NavLink>
        <NavLink to="/services">Сервисы</NavLink>
        <button type="button" className="logout" onClick={logout}>
          Выйти
        </button>
      </nav>
      {children}
    </>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn());

  useEffect(() => {
    const check = () => setLoggedIn(isAdminLoggedIn());
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);

  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage onLogin={() => setLoggedIn(true)} />}
      />
      <Route
        path="/"
        element={
          loggedIn ? (
            <Layout onLogout={() => setLoggedIn(false)}>
              <UsersPage />
            </Layout>
          ) : (
            <LoginPage onLogin={() => setLoggedIn(true)} />
          )
        }
      />
      <Route
        path="/plans"
        element={
          loggedIn ? (
            <Layout onLogout={() => setLoggedIn(false)}>
              <PlansPage />
            </Layout>
          ) : (
            <LoginPage onLogin={() => setLoggedIn(true)} />
          )
        }
      />
      <Route
        path="/projects"
        element={
          loggedIn ? (
            <Layout onLogout={() => setLoggedIn(false)}>
              <ProjectsPage />
            </Layout>
          ) : (
            <LoginPage onLogin={() => setLoggedIn(true)} />
          )
        }
      />
      <Route
        path="/services"
        element={
          loggedIn ? (
            <Layout onLogout={() => setLoggedIn(false)}>
              <ServicesPage />
            </Layout>
          ) : (
            <LoginPage onLogin={() => setLoggedIn(true)} />
          )
        }
      />
      <Route
        path="/site-media"
        element={
          loggedIn ? (
            <Layout onLogout={() => setLoggedIn(false)}>
              <SiteMediaPage />
            </Layout>
          ) : (
            <LoginPage onLogin={() => setLoggedIn(true)} />
          )
        }
      />
      <Route
        path="/site-content"
        element={
          loggedIn ? (
            <Layout onLogout={() => setLoggedIn(false)}>
              <SiteContentPage />
            </Layout>
          ) : (
            <LoginPage onLogin={() => setLoggedIn(true)} />
          )
        }
      />
      <Route
        path="/site-events"
        element={
          loggedIn ? (
            <Layout onLogout={() => setLoggedIn(false)}>
              <SiteEventsCrudPage />
            </Layout>
          ) : (
            <LoginPage onLogin={() => setLoggedIn(true)} />
          )
        }
      />
      <Route
        path="/site-marquee"
        element={
          loggedIn ? (
            <Layout onLogout={() => setLoggedIn(false)}>
              <SiteMarqueePage />
            </Layout>
          ) : (
            <LoginPage onLogin={() => setLoggedIn(true)} />
          )
        }
      />
    </Routes>
  );
}
