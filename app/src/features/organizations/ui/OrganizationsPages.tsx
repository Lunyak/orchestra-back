import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Modal } from "@shared/core/modal/Modal";
import cn from "classnames";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  globalPaths,
  organizationsPath,
  projectPath,
  studioOverviewPath,
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
  type StudioSummary,
} from "../../studio";
import {
  readTheaterPoster,
  THEATER_POSTER_CHANGE_EVENT,
} from "../model/theater-poster-storage";
import { readStudioPoster } from "../model/studio-poster-storage";
import { StudioLogo } from "../../../pages/studio/StudioLogo";
import {
  OrganizationCreateModal,
  type OrganizationKind,
} from "./OrganizationCreateModal";
import "../../app-hub/ui/app-hub.css";
import "../../director-sessions/ui/director-sessions.css";
import "./organizations.css";
import "../../spectacle/ui/spectacle-direction-switch.css";

type OrganizationFilter = "all" | OrganizationKind;

type OrganizationListItem = {
  id: string;
  kind: OrganizationKind;
  title: string;
  meta: string;
  path: string;
  theaterPoster?: string | null;
  studioImageUrl?: string | null;
  studioLocalPoster?: string | null;
};

const FILTER_OPTIONS: { id: OrganizationFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "theater", label: "Театры" },
  { id: "troupe", label: "Коллективы" },
  { id: "studio", label: "Студии" },
];

const KIND_LABEL: Record<OrganizationKind, string> = {
  theater: "Театр",
  troupe: "Коллектив",
  studio: "Студия",
};

function parseOrganizationFilter(value: string | null): OrganizationFilter {
  if (value === "theater" || value === "troupe" || value === "studio") return value;
  return "all";
}

function studioRoleLabel(role: StudioSummary["myRole"]): string {
  if (role === "owner") return "Владелец";
  if (role === "teacher") return "Преподаватель";
  return "Ученик";
}

function buildOrganizationItems(
  theaters: TheaterSummary[],
  troupes: TroupeSummary[],
  studios: StudioSummary[],
): OrganizationListItem[] {
  const theaterItems: OrganizationListItem[] = theaters.map((theater) => {
    const premisesCount = theater.premises.length;
    const premisesLabel =
      premisesCount === 0 ? "Без площадок" : `${premisesCount} площадок`;

    return {
      id: theater.id,
      kind: "theater",
      title: theater.title,
      meta: premisesLabel,
      path: theaterOverviewPath(theater.id),
      theaterPoster: readTheaterPoster(theater.id),
    };
  });

  const troupeItems: OrganizationListItem[] = troupes.map((troupe) => ({
    id: troupe.id,
    kind: "troupe",
    title: troupe.title,
    meta: troupe.theater?.title ?? "Независимый коллектив",
    path: troupeOrganizationPath(troupe.id),
  }));

  const studioItems: OrganizationListItem[] = studios.map((studio) => ({
    id: studio.id,
    kind: "studio",
    title: studio.title,
    meta: studioRoleLabel(studio.myRole),
    path: studioOverviewPath(studio.id),
    studioImageUrl: studio.imageUrl,
    studioLocalPoster: readStudioPoster(studio.id),
  }));

  return [...theaterItems, ...troupeItems, ...studioItems].sort((left, right) =>
    left.title.localeCompare(right.title, "ru"),
  );
}

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

function OrganizationPoster({
  item,
  posterTick,
}: {
  item: OrganizationListItem;
  posterTick: number;
}) {
  void posterTick;

  if (item.kind === "theater") {
    const posterSrc = item.theaterPoster;
    const hasPoster = Boolean(posterSrc);

    return (
      <span
        className={cn(
          "organizations-page__theater-poster-frame",
          !hasPoster && "organizations-page__theater-poster-frame--placeholder",
        )}
      >
        {hasPoster ? (
          <img
            className="organizations-page__theater-poster-image"
            src={posterSrc!}
            alt=""
          />
        ) : (
          <span className="organizations-page__theater-poster-hint">Театр</span>
        )}
      </span>
    );
  }

  if (item.kind === "studio") {
    const localPoster = item.studioLocalPoster;
    const hasPoster = Boolean(localPoster || item.studioImageUrl);

    return (
      <span
        className={cn(
          "organizations-page__theater-poster-frame",
          !hasPoster && "organizations-page__theater-poster-frame--placeholder",
        )}
      >
        {localPoster ? (
          <img
            className="organizations-page__theater-poster-image"
            src={localPoster}
            alt=""
          />
        ) : item.studioImageUrl ? (
          <StudioLogo
            imageUrl={item.studioImageUrl}
            title={item.title}
            size="tile"
            className="organizations-page__theater-poster-image"
          />
        ) : (
          <span className="organizations-page__theater-poster-hint">Студия</span>
        )}
      </span>
    );
  }

  return (
    <span className="organizations-page__theater-poster-frame organizations-page__theater-poster-frame--placeholder">
      <span className="organizations-page__theater-poster-hint">Коллектив</span>
    </span>
  );
}

export function OrganizationsPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theaters, troupes, studios, loading, error, reload } = useOrganizations();
  const [createStudio, { isLoading: creatingStudio }] = useCreateStudioMutation();
  const [query, setQuery] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [posterTick, setPosterTick] = useState(0);

  const filter = parseOrganizationFilter(searchParams.get("type"));
  const createModalInitialKind: OrganizationKind = filter === "all" ? "theater" : filter;
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    const refreshPosters = () => setPosterTick((value) => value + 1);
    window.addEventListener(THEATER_POSTER_CHANGE_EVENT, refreshPosters);
    window.addEventListener("storage", refreshPosters);
    return () => {
      window.removeEventListener(THEATER_POSTER_CHANGE_EVENT, refreshPosters);
      window.removeEventListener("storage", refreshPosters);
    };
  }, []);

  const allItems = useMemo(
    () => buildOrganizationItems(theaters, troupes, studios),
    [theaters, troupes, studios, posterTick],
  );

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const matchesFilter = filter === "all" || item.kind === filter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.meta.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [allItems, filter, normalizedQuery]);

  const counts = useMemo(
    () => ({
      all: allItems.length,
      theater: theaters.length,
      troupe: troupes.length,
      studio: studios.length,
    }),
    [allItems.length, studios.length, theaters.length, troupes.length],
  );

  const activeFilterLabel =
    FILTER_OPTIONS.find((option) => option.id === filter)?.label ?? "Все";

  const handleFilterChange = (nextFilter: OrganizationFilter) => {
    if (nextFilter === "all") {
      setSearchParams({});
      return;
    }
    setSearchParams({ type: nextFilter });
  };

  const openCreateModal = () => {
    setCreateError("");
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (creating || creatingStudio) return;
    setCreateError("");
    setCreateModalOpen(false);
  };

  const handleCreateSubmit = async ({
    kind,
    title,
  }: {
    kind: OrganizationKind;
    title: string;
  }) => {
    if (!accessToken || creating || creatingStudio) return;

    setCreating(true);
    setCreateError("");

    try {
      if (kind === "theater") {
        await createTheater(accessToken, title);
        await reload();
      } else if (kind === "troupe") {
        const troupe = await createTroupe(accessToken, title);
        await reload();
        setCreateModalOpen(false);
        navigate(troupeOrganizationPath(troupe.id));
        return;
      } else {
        const studio = await createStudio({ title }).unwrap();
        setCreateModalOpen(false);
        navigate(studioOverviewPath(studio.id));
        return;
      }
      setCreateModalOpen(false);
    } catch {
      setCreateError("Не удалось создать организацию");
    } finally {
      setCreating(false);
    }
  };

  const isCreating = creating || creatingStudio;
  const emptyAfterFilter = !loading && filteredItems.length === 0;
  const hasAnyOrganizations = allItems.length > 0;

  return (
    <div className="app-layout app-hub-layout app-hub-layout--projects">
      <div className="app-content">
        <main className="main-content">
          <section
            className="organizations-page organizations-page--theaters"
            aria-labelledby="organizations-workspace-title"
          >
            <header className="organizations-page__workspace-header">
              <div>
                <h1 id="organizations-workspace-title">Организации</h1>
                <p className="organizations-page__workspace-description">
                  Театры, коллективы и студии в одном списке.
                </p>
              </div>
              <div className="organizations-page__workspace-actions">
                <button
                  type="button"
                  className="organizations-page__workspace-create-button"
                  onClick={openCreateModal}
                  aria-label="Создать организацию"
                  title="Создать организацию"
                >
                  <span className="organizations-page__workspace-create-label">
                    Создать
                  </span>
                  <span className="organizations-page__workspace-create-icon" aria-hidden>+</span>
                </button>
              </div>
            </header>

            <OrganizationCreateModal
              isOpen={createModalOpen}
              initialKind={createModalInitialKind}
              isSubmitting={isCreating}
              error={createError}
              onClose={closeCreateModal}
              onSubmit={(payload) => {
                void handleCreateSubmit(payload);
              }}
            />

            <div className="organizations-page__toolbar">
              <label className="organizations-page__search">
                <span className="organizations-page__search-label">Поиск</span>
                <input
                  className="organizations-page__workspace-input organizations-page__search-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Название или описание"
                  type="search"
                />
              </label>
              <div
                className="organizations-page__filters organizations-page__filters--desktop"
                role="group"
                aria-label="Фильтр по типу"
              >
                {FILTER_OPTIONS.map((option) => {
                  const count = counts[option.id];
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className="organizations-page__filter-btn"
                      aria-pressed={filter === option.id}
                      onClick={() => handleFilterChange(option.id)}
                    >
                      {option.label}
                      <span className="organizations-page__filter-count">{count}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="organizations-page__filter-trigger"
                onClick={() => setFilterModalOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={filterModalOpen}
              >
                {activeFilterLabel}
                <span className="organizations-page__filter-count">
                  {counts[filter]}
                </span>
              </button>
            </div>

            <Modal
              isOpen={filterModalOpen}
              onClose={() => setFilterModalOpen(false)}
              panelClassName="organizations-filter-modal"
              ariaLabelledBy="organizations-filter-modal-title"
            >
              <div className="organizations-filter-modal__body">
                <h2
                  id="organizations-filter-modal-title"
                  className="organizations-filter-modal__title"
                >
                  Тип организации
                </h2>
                <div
                  className="organizations-filter-modal__list"
                  role="group"
                  aria-label="Фильтр по типу"
                >
                  {FILTER_OPTIONS.map((option) => {
                    const isActive = filter === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={cn(
                          "organizations-filter-modal__option",
                          isActive && "organizations-filter-modal__option--active",
                        )}
                        aria-pressed={isActive}
                        onClick={() => {
                          handleFilterChange(option.id);
                          setFilterModalOpen(false);
                        }}
                      >
                        <span>{option.label}</span>
                        <span className="organizations-page__filter-count">
                          {counts[option.id]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Modal>

            {error ? (
              <p className="organizations-page__workspace-error" role="alert">
                {error}
              </p>
            ) : null}

            {loading ? (
              <PageLoader variant="view" label="Загрузка организаций…" />
            ) : emptyAfterFilter ? (
              <div className="organizations-page__workspace-empty">
                <h2>
                  {hasAnyOrganizations
                    ? "Ничего не найдено"
                    : "Здесь пока нет организаций"}
                </h2>
                <p>
                  {hasAnyOrganizations
                    ? "Измените поиск или фильтр."
                    : "Выберите тип и создайте первую организацию."}
                </p>
              </div>
            ) : (
              <ul className="organizations-page__theater-list">
                {filteredItems.map((item) => (
                  <li key={`${item.kind}:${item.id}`}>
                    <button
                      type="button"
                      className="organizations-page__theater-poster"
                      onClick={() => navigate(item.path)}
                    >
                      <OrganizationPoster item={item} posterTick={posterTick} />
                      <span className="organizations-page__org-type">
                        {KIND_LABEL[item.kind]}
                      </span>
                      <span className="organizations-page__theater-poster-name">
                        {item.title}
                      </span>
                      <span className="organizations-page__theater-poster-meta">
                        {item.meta}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export function TheatersIndexPage() {
  return <Navigate to={organizationsPath("theater")} replace />;
}

export function TroupesIndexPage() {
  return <Navigate to={organizationsPath("troupe")} replace />;
}

export function StudiosIndexPage() {
  return <Navigate to={organizationsPath("studio")} replace />;
}

export function TheaterOrganizationPage() {
  const { theaterId = "" } = useParams();
  if (!theaterId) {
    return <Navigate to={globalPaths.organizations} replace />;
  }
  return <Navigate to={theaterOverviewPath(theaterId)} replace />;
}

export function TroupeOrganizationPage() {
  const { troupeId = "" } = useParams();
  const { troupes, loading, error } = useOrganizations();
  const { projectItems } = useProject();
  const troupe = troupes.find((item) => item.id === troupeId);

  if (!loading && !troupe) {
    return <Navigate to={globalPaths.organizations} replace />;
  }

  const projects = projectItems.filter(
    (project) => project.workspace?.id === troupe?.workspaceId,
  );

  return (
    <OrganizationDetail
      title={troupe?.title}
      loading={loading}
      error={error}
      backPath={globalPaths.organizations}
      backLabel="← Организации"
    >
      <OrganizationProjects projects={projects} />
    </OrganizationDetail>
  );
}

export function StudioOrganizationPage() {
  const { studioId = "" } = useParams();
  if (!studioId) {
    return <Navigate to={globalPaths.organizations} replace />;
  }
  return <Navigate to={studioOverviewPath(studioId)} replace />;
}

type OrganizationDetailProps = {
  title?: string;
  loading: boolean;
  error: string;
  children: ReactNode;
  backPath?: string;
  backLabel?: string;
};

function OrganizationDetail({
  title,
  loading,
  error,
  children,
  backPath = globalPaths.organizations,
  backLabel = "← Организации",
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
