import React, { useCallback, useEffect, useState } from "react";
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
        <NavLink to="/projects">Проекты</NavLink>
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
    </Routes>
  );
}
