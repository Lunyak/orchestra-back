import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  globalPaths,
  projectPath,
  studioOrganizationPath,
  studioOverviewPath,
  theaterOrganizationPath,
  theaterOverviewPath,
  troupeOrganizationPath,
} from "../../../app/router/paths";
import {
  createTheater,
  createTroupe,
  fetchTheaters,
  fetchTroupes,
  type TheaterSummary,
  type TroupeSummary,
} from "../../../sync/api/workspaces";
import { useAuth } from "../../auth/model/auth-context";
import { useProject } from "../../project";
import {
  useCreateStudioMutation,
  useListStudiosQuery,
} from "../../studio";
import {
  readTheaterPoster,
  THEATER_POSTER_CHANGE_EVENT,
} from "../model/theater-poster-storage";
import "../../app-hub/ui/app-hub.css";
import "../../director-sessions/ui/director-sessions.css";
import "./organizations.css";
import "../../spectacle/ui/spectacle-direction-switch.css";
import orgPosterTheatersUrl from "../assets/org-poster-theaters.jpg";
import orgPosterTroupesUrl from "../assets/org-poster-troupes.jpg";
import orgPosterStudiosUrl from "../assets/org-poster-studios.jpg";

const hubPosterById = {
  theaters: orgPosterTheatersUrl,
  troupes: orgPosterTroupesUrl,
  studios: orgPosterStudiosUrl,
} as const;

function useOrganizations() {
  const { accessToken } = useAuth();
  const [theaters, setTheaters] = useState<TheaterSummary[]>([]);
  const [troupes, setTroupes] = useState<TroupeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const {
    data: studiosData,
    isLoading: studiosLoading,
    isError: studiosError,
  } = useListStudiosQuery(undefined, { skip: !accessToken });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const [theaterItems, troupeItems] = await Promise.all([
        fetchTheaters(accessToken),
        fetchTroupes(accessToken),
      ]);
      setTheaters(theaterItems);
      setTroupes(troupeItems);
    } catch {
      setError("Не удалось загрузить организации");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const studios = studiosData?.studios ?? [];
  const pageLoading = loading || studiosLoading;
  const pageError = error || (studiosError ? "Не удалось загрузить студии" : "");

  return {
    theaters,
    troupes,
    studios,
    loading: pageLoading,
    error: pageError,
    reload: load,
  };
}

export function OrganizationsPage() {
  const { theaters, troupes, studios, loading, error } = useOrganizations();

  const hubCards = [
    {
      id: "theaters" as const,
      title: "Театры",
      description: "Коллектив и команда театра",
      meta: loading ? "…" : `${theaters.length}`,
      path: theaterOrganizationPath(),
    },
    {
      id: "troupes" as const,
      title: "Коллективы",
      description: "Независимые и театральные коллективы",
      meta: loading ? "…" : `${troupes.length}`,
      path: troupeOrganizationPath(),
    },
    {
      id: "studios" as const,
      title: "Студии",
      description: "Учебные пространства и программа",
      meta: loading ? "…" : `${studios.length}`,
      path: studioOrganizationPath(),
    },
  ];

  return (
    <main className="organizations-page">
      <div className="organizations-page__content">
        <header className="organizations-page__header">
          <p>Рабочие пространства</p>
          <h1>Организации</h1>
          <span>Выберите тип организации, чтобы открыть список.</span>
        </header>
        {error ? (
          <p className="organizations-page__alert" role="alert">
            {error}
          </p>
        ) : null}
        <ul className="organizations-page__hub">
          {hubCards.map((card) => (
            <li key={card.id}>
              <Link className="organizations-page__hub-card" to={card.path}>
                <span className="organizations-page__hub-card-frame">
                  <img
                    className="organizations-page__hub-card-image"
                    src={hubPosterById[card.id]}
                    alt=""
                  />
                  <span className="organizations-page__hub-count">
                    {card.meta}
                  </span>
                </span>
                <span className="organizations-page__hub-card-name">
                  {card.title}
                </span>
                <span className="organizations-page__hub-card-meta">
                  {card.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

export function TheatersIndexPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const { theaters, loading, error, reload } = useOrganizations();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [posterTick, setPosterTick] = useState(0);
  const hasTheaters = theaters.length > 0;

  useEffect(() => {
    const refreshPosters = () => setPosterTick((value) => value + 1);
    window.addEventListener(THEATER_POSTER_CHANGE_EVENT, refreshPosters);
    window.addEventListener("storage", refreshPosters);
    return () => {
      window.removeEventListener(THEATER_POSTER_CHANGE_EVENT, refreshPosters);
      window.removeEventListener("storage", refreshPosters);
    };
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      setCreateError("Введите название театра");
      return;
    }
    if (!accessToken || creating) return;

    setCreating(true);
    setCreateError("");
    try {
      await createTheater(accessToken, nextTitle);
      setTitle("");
      await reload();
    } catch {
      setCreateError("Не удалось создать театр");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="app-layout app-hub-layout app-hub-layout--projects">
      <div className="app-content">
        <main className="main-content">
          <section
            className="organizations-page organizations-page--theaters"
            aria-labelledby="theaters-workspace-title"
          >
            <header className="organizations-page__workspace-header">
              <div>
                <h1 id="theaters-workspace-title">Мои театры</h1>
                <p className="organizations-page__workspace-description">
                  Выберите театр или создайте новый.
                </p>
              </div>
              <form
                className="organizations-page__workspace-create"
                onSubmit={(event) => {
                  void handleCreate(event);
                }}
              >
                <label htmlFor="new-theater-title">Новый театр</label>
                <div className="organizations-page__workspace-create-row">
                  <input
                    id="new-theater-title"
                    className="organizations-page__workspace-input"
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      if (createError) setCreateError("");
                    }}
                    placeholder="Название театра"
                    maxLength={120}
                    disabled={creating}
                  />
                  <button
                    type="submit"
                    className="organizations-page__workspace-create-button"
                    disabled={!title.trim() || creating}
                  >
                    {creating ? "Создание…" : "Создать"}
                  </button>
                </div>
                {createError ? (
                  <p className="organizations-page__workspace-error" role="alert">
                    {createError}
                  </p>
                ) : null}
              </form>
            </header>

            {error ? (
              <p className="organizations-page__workspace-error" role="alert">
                {error}
              </p>
            ) : null}

            {loading ? (
              <PageLoader variant="view" label="Загрузка театров…" />
            ) : hasTheaters ? (
              <ul className="organizations-page__theater-list">
                {theaters.map((theater) => {
                  const premisesCount = theater.premises.length;
                  const premisesLabel =
                    premisesCount === 0
                      ? "Без площадок"
                      : `${premisesCount} площадок`;
                  void posterTick;
                  const posterSrc = readTheaterPoster(theater.id);
                  const hasPoster = Boolean(posterSrc);

                  return (
                    <li key={theater.id}>
                      <button
                        type="button"
                        className="organizations-page__theater-poster"
                        onClick={() =>
                          navigate(theaterOverviewPath(theater.id))
                        }
                      >
                        <span
                          className={cn(
                            "organizations-page__theater-poster-frame",
                            !hasPoster &&
                              "organizations-page__theater-poster-frame--placeholder",
                          )}
                        >
                          {hasPoster ? (
                            <img
                              className="organizations-page__theater-poster-image"
                              src={posterSrc!}
                              alt=""
                            />
                          ) : (
                            <span className="organizations-page__theater-poster-hint">
                              Театр
                            </span>
                          )}
                        </span>
                        <span className="organizations-page__theater-poster-name">
                          {theater.title}
                        </span>
                        <span className="organizations-page__theater-poster-meta">
                          {premisesLabel}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="organizations-page__workspace-empty">
                <h2>Здесь пока нет театров</h2>
                <p>Введите название и создайте первый театр.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export function TroupesIndexPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const { troupes, loading, error, reload } = useOrganizations();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!accessToken || !nextTitle || creating) return;

    setCreating(true);
    setCreateError("");
    try {
      const troupe = await createTroupe(accessToken, nextTitle);
      setTitle("");
      await reload();
      navigate(troupeOrganizationPath(troupe.id));
    } catch {
      setCreateError("Не удалось создать коллектив");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="organizations-page organizations-page--theaters">
      <div className="organizations-page__content">
        <Link
          className="organizations-page__back"
          to={globalPaths.organizations}
        >
          ← Организации
        </Link>
        <header className="organizations-page__theaters-header">
          <div>
            <p className="organizations-page__eyebrow">Коллективы</p>
            <h1>Коллективы</h1>
            <span>
              Коллектив может работать независимо или быть связан с театром.
            </span>
          </div>
          <form
            className="organizations-page__theaters-create"
            onSubmit={(event) => {
              void handleCreate(event);
            }}
          >
            <label htmlFor="new-troupe-title">Новый коллектив</label>
            <div className="organizations-page__theaters-create-row">
              <input
                id="new-troupe-title"
                className="native-text-input organizations-page__theaters-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Название коллектива"
                maxLength={120}
              />
              <Button type="submit" disabled={!title.trim() || creating}>
                {creating ? "Создание…" : "Создать"}
              </Button>
            </div>
            {createError ? (
              <p className="organizations-page__alert" role="alert">
                {createError}
              </p>
            ) : null}
          </form>
        </header>

        {loading ? (
          <PageLoader variant="view" label="Загрузка коллективов…" />
        ) : null}
        {error ? (
          <p className="organizations-page__alert" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && troupes.length === 0 ? (
          <div className="organizations-page__empty">
            <p>Пока нет коллективов. Создайте независимый коллектив.</p>
          </div>
        ) : null}
        {!loading && troupes.length ? (
          <ul className="organizations-page__theater-grid">
            {troupes.map((troupe) => (
              <li key={troupe.id}>
                <Link
                  className="organizations-page__theater-card"
                  to={troupeOrganizationPath(troupe.id)}
                >
                  <strong>{troupe.title}</strong>
                  <span>
                    {troupe.theater?.title ?? "Независимый коллектив"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </main>
  );
}

export function StudiosIndexPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { studios, loading, error } = useOrganizations();
  const [createStudio, { isLoading: creating }] = useCreateStudioMutation();
  const [title, setTitle] = useState("");
  const [createError, setCreateError] = useState("");
  const hasStudios = studios.length > 0;

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      setCreateError("Введите название студии");
      return;
    }
    if (!accessToken || creating) return;

    setCreateError("");
    try {
      const studio = await createStudio({ title: nextTitle }).unwrap();
      setTitle("");
      navigate(studioOverviewPath(studio.id));
    } catch {
      setCreateError("Не удалось создать студию");
    }
  };

  return (
    <div className="app-layout app-hub-layout app-hub-layout--projects">
      <div className="app-content">
        <main className="main-content">
          <section
            className="organizations-page organizations-page--theaters"
            aria-labelledby="studios-workspace-title"
          >
            <header className="organizations-page__workspace-header">
              <div>
                <h1 id="studios-workspace-title">Мои студии</h1>
                <p className="organizations-page__workspace-description">
                  Выберите студию или создайте новую.
                </p>
              </div>
              <form
                className="organizations-page__workspace-create"
                onSubmit={(event) => {
                  void handleCreate(event);
                }}
              >
                <label htmlFor="new-studio-title">Новая студия</label>
                <div className="organizations-page__workspace-create-row">
                  <input
                    id="new-studio-title"
                    className="organizations-page__workspace-input"
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      if (createError) setCreateError("");
                    }}
                    placeholder="Название студии"
                    maxLength={120}
                    disabled={creating}
                  />
                  <button
                    type="submit"
                    className="organizations-page__workspace-create-button"
                    disabled={!title.trim() || creating}
                  >
                    {creating ? "Создание…" : "Создать"}
                  </button>
                </div>
                {createError ? (
                  <p className="organizations-page__workspace-error" role="alert">
                    {createError}
                  </p>
                ) : null}
              </form>
            </header>

            {error ? (
              <p className="organizations-page__workspace-error" role="alert">
                {error}
              </p>
            ) : null}

            {loading ? (
              <PageLoader variant="view" label="Загрузка студий…" />
            ) : hasStudios ? (
              <ul className="organizations-page__theater-list">
                {studios.map((studio) => {
                  const roleLabel =
                    studio.myRole === "owner"
                      ? "Владелец"
                      : studio.myRole === "teacher"
                        ? "Преподаватель"
                        : "Ученик";

                  return (
                    <li key={studio.id}>
                      <button
                        type="button"
                        className="organizations-page__theater-poster"
                        onClick={() =>
                          navigate(studioOverviewPath(studio.id))
                        }
                      >
                        <span className="organizations-page__theater-poster-frame organizations-page__theater-poster-frame--placeholder">
                          <span className="organizations-page__theater-poster-hint">
                            Студия
                          </span>
                        </span>
                        <span className="organizations-page__theater-poster-name">
                          {studio.title}
                        </span>
                        <span className="organizations-page__theater-poster-meta">
                          {roleLabel}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="organizations-page__workspace-empty">
                <h2>Здесь пока нет студий</h2>
                <p>Введите название и создайте первую студию.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export function TheaterOrganizationPage() {
  const { theaterId = "" } = useParams();
  if (!theaterId) {
    return <Navigate to={theaterOrganizationPath()} replace />;
  }
  return <Navigate to={theaterOverviewPath(theaterId)} replace />;
}

export function TroupeOrganizationPage() {
  const { troupeId = "" } = useParams();
  const { troupes, loading, error } = useOrganizations();
  const { projectItems } = useProject();
  const troupe = troupes.find((item) => item.id === troupeId);

  if (!loading && !troupe) {
    return <Navigate to={troupeOrganizationPath()} replace />;
  }

  const projects = projectItems.filter(
    (project) => project.workspace?.id === troupe?.workspaceId,
  );

  return (
    <OrganizationDetail
      title={troupe?.title}
      loading={loading}
      error={error}
      backPath={troupeOrganizationPath()}
      backLabel="← Все коллективы"
    >
      <OrganizationProjects projects={projects} />
    </OrganizationDetail>
  );
}

export function StudioOrganizationPage() {
  const { studioId = "" } = useParams();
  if (!studioId) {
    return <Navigate to={studioOrganizationPath()} replace />;
  }
  return <Navigate to={studioOverviewPath(studioId)} replace />;
}

type OrganizationDetailProps = {
  title?: string;
  loading: boolean;
  error: string;
  children: React.ReactNode;
  backPath?: string;
  backLabel?: string;
};

function OrganizationDetail({
  title,
  loading,
  error,
  children,
  backPath = globalPaths.organizations,
  backLabel = "← Все организации",
}: OrganizationDetailProps) {
  return (
    <main className="organizations-page organizations-page--detail">
      <div className="organizations-page__content">
        <Link className="organizations-page__back" to={backPath}>
          {backLabel}
        </Link>
        {loading ? (
          <PageLoader variant="view" label="Загрузка организации…" />
        ) : null}
        {error ? (
          <p className="organizations-page__alert" role="alert">
            {error}
          </p>
        ) : null}
        {title ? <h1>{title}</h1> : null}
        {title ? children : null}
      </div>
    </main>
  );
}

function OrganizationProjects({
  projects,
}: {
  projects: ReturnType<typeof useProject>["projectItems"];
}) {
  return (
    <section>
      <h2>Проекты пространства</h2>
      {projects.length ? (
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <Link to={projectPath(project.slug)}>{project.name}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>Связанные проекты не найдены в доступных данных.</p>
      )}
    </section>
  );
}
