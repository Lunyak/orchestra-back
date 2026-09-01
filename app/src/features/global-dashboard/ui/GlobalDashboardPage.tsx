import { PageBootLoader } from "@shared/components/page-loader/page-boot";
import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  globalPaths,
  projectPath,
  projectTaskPath,
  studioAssignmentPath,
  studioOverviewPath,
  theaterOverviewPath,
} from "../../../app/router/paths";
import {
  fetchTheaters,
  type TheaterSummary,
} from "../../../sync/api/workspaces";
import { useAuth } from "../../auth";
import { useProject } from "../../project";
import { PROJECT_TASK_STATUS_LABELS } from "../../project-tasks/model/project-task-labels";
import { useListStudiosQuery } from "../../studio";
import {
  type DashboardAction,
  type DashboardInviteAction,
  type DashboardTask,
  useAnswerDashboardDirectorSessionMutation,
  useAnswerDashboardInviteMutation,
  useAnswerDashboardRehearsalMutation,
  useGlobalDashboardQuery,
} from "../api/dashboard-api";
import {
  isIncomingMailAction,
  isInviteAction,
  inviteActionKey,
} from "../model/dashboard-invite";
import { resolveDashboardViewState } from "../model/dashboard-view-state";
import { readRecentOrganizations } from "../model/recent-organizations-storage";
import { rememberSeenInviteMailKeys } from "../model/seen-invite-mail-storage";
import iconAlert from "../assets/icon-alert.png";
import iconBuilding from "../assets/icon-building.png";
import iconCalendar from "../assets/icon-calendar.png";
import iconMail from "../assets/icon-mail.png";
import iconSquare from "../assets/icon-square.png";
import { DashboardInviteModal } from "./DashboardInviteModal";
import "../../director-sessions/ui/director-sessions.css";
import "./global-dashboard.css";

dayjs.locale("ru");

type DashboardIconName =
  | "calendar"
  | "alert"
  | "square"
  | "building"
  | "mail";

const DASHBOARD_ICON_SRC: Record<DashboardIconName, string> = {
  calendar: iconCalendar,
  alert: iconAlert,
  square: iconSquare,
  building: iconBuilding,
  mail: iconMail,
};

function DashboardIcon({
  name,
  className,
}: {
  name: DashboardIconName;
  className?: string;
}) {
  return (
    <img
      className={cn("global-dashboard__icon", className)}
      src={DASHBOARD_ICON_SRC[name]}
      alt=""
      draggable={false}
    />
  );
}

function formatDate(value: string | null) {
  if (!value) return "Без срока";
  const date = dayjs(value);
  return date.isValid() ? date.format("D MMMM, HH:mm") : "Дата не указана";
}

function formatUpdatedAt(value: string | undefined) {
  if (!value) return "Дата неизвестна";
  const date = dayjs(value);
  return date.isValid() ? date.format("D MMMM, HH:mm") : "Дата неизвестна";
}

function formatOpenedAt(value: number) {
  const date = dayjs(value);
  return date.isValid() ? date.format("D MMMM, HH:mm") : "Дата неизвестна";
}

function taskStatusLabel(status: DashboardTask["status"]) {
  return PROJECT_TASK_STATUS_LABELS[status];
}

function EmptyState({
  icon,
  children,
  align = "center",
}: {
  icon: DashboardIconName;
  children: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "global-dashboard__empty-state",
        align === "start" && "global-dashboard__empty-state--start",
      )}
    >
      <DashboardIcon name={icon} />
      <span>{children}</span>
    </div>
  );
}

function ActionControls({
  action,
  busy,
  onOpenInvite,
  onAnswerRehearsal,
  onAnswerSession,
}: {
  action: DashboardAction;
  busy: boolean;
  onOpenInvite: (action: DashboardInviteAction) => void;
  onAnswerRehearsal: (
    rehearsalId: string,
    status: "present" | "absent",
  ) => void;
  onAnswerSession: (
    sessionId: string,
    response: "confirm" | "decline",
  ) => void;
}) {
  if (isInviteAction(action)) {
    return (
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => onOpenInvite(action)}
      >
        Открыть
      </Button>
    );
  }
  if (action.kind === "rehearsal_response") {
    return (
      <div className="global-dashboard__action-buttons">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => onAnswerRehearsal(action.id, "present")}
        >
          Буду
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => onAnswerRehearsal(action.id, "absent")}
        >
          Не буду
        </Button>
      </div>
    );
  }
  if (action.kind === "director_session_invitation") {
    return (
      <div className="global-dashboard__action-buttons">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => onAnswerSession(action.id, "confirm")}
        >
          Подтвердить
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => onAnswerSession(action.id, "decline")}
        >
          Отклонить
        </Button>
      </div>
    );
  }
  return (
    <Link
      className="global-dashboard__text-link"
      to={studioAssignmentPath(action.studioId, action.id)}
    >
      Открыть
    </Link>
  );
}

export function GlobalDashboardPage() {
  const { accessToken } = useAuth();
  const { projectItems, projectsLoading } = useProject();
  const dashboard = useGlobalDashboardQuery(undefined, {
    skip: !accessToken,
  });
  const studiosQuery = useListStudiosQuery(undefined, {
    skip: !accessToken,
  });
  const [answerInvite, answerInviteState] = useAnswerDashboardInviteMutation();
  const [answerRehearsal, answerRehearsalState] =
    useAnswerDashboardRehearsalMutation();
  const [answerSession, answerSessionState] =
    useAnswerDashboardDirectorSessionMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const [openedInvite, setOpenedInvite] =
    useState<DashboardInviteAction | null>(null);
  const [theaters, setTheaters] = useState<TheaterSummary[]>([]);
  const [theatersLoading, setTheatersLoading] = useState(false);
  const data = dashboard.data;
  const studios = studiosQuery.data?.studios ?? [];
  const recentProjects = [...projectItems]
    .sort((left, right) => {
      const leftTime = dayjs(left.updatedAt).valueOf();
      const rightTime = dayjs(right.updatedAt).valueOf();
      const leftSafe = Number.isFinite(leftTime) ? leftTime : 0;
      const rightSafe = Number.isFinite(rightTime) ? rightTime : 0;
      return rightSafe - leftSafe;
    })
    .slice(0, 5);
  const recentOrganizationRefs = readRecentOrganizations();
  const organizationsLoading = theatersLoading || studiosQuery.isLoading;
  const recentOrganizations = recentOrganizationRefs.flatMap((ref) => {
    if (ref.kind === "theater") {
      const theater = theaters.find((item) => item.id === ref.id);
      if (!theater) return [];
      return [
        {
          key: `theater:${theater.id}`,
          title: theater.title,
          typeLabel: "Театр",
          path: theaterOverviewPath(theater.id),
          openedAt: ref.openedAt,
        },
      ];
    }
    const studio = studios.find((item) => item.id === ref.id);
    if (!studio) return [];
    return [
      {
        key: `studio:${studio.id}`,
        title: studio.title,
        typeLabel: "Студия",
        path: studioOverviewPath(studio.id),
        openedAt: ref.openedAt,
      },
    ];
  }).slice(0, 5);

  useEffect(() => {
    if (!accessToken) {
      setTheaters([]);
      return;
    }

    let cancelled = false;
    setTheatersLoading(true);
    fetchTheaters(accessToken)
      .then((items) => {
        if (cancelled) return;
        setTheaters(items);
      })
      .catch(() => {
        if (cancelled) return;
        setTheaters([]);
      })
      .finally(() => {
        if (!cancelled) setTheatersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const actionBusy =
    answerInviteState.isLoading ||
    answerRehearsalState.isLoading ||
    answerSessionState.isLoading;
  const isEmpty =
    data?.summary.projects === 0 &&
    data.summary.upcomingRehearsals === 0 &&
    data.summary.openTasks === 0 &&
    data.summary.actions === 0 &&
    data.summary.unreadChat === 0;
  const viewState = resolveDashboardViewState({
    isLoading: dashboard.isLoading,
    isError: dashboard.isError,
    hasData: data !== undefined,
    isEmpty,
  });

  const openInvite = (action: DashboardInviteAction) => {
    setActionError(null);
    rememberSeenInviteMailKeys([inviteActionKey(action)]);
    setOpenedInvite(action);
  };

  const runAction = async (request: Promise<unknown>) => {
    setActionError(null);
    try {
      await request;
      setOpenedInvite(null);
    } catch {
      setActionError("Не удалось выполнить действие. Попробуйте ещё раз.");
    }
  };

  if (!accessToken) {
    return (
      <main className="global-dashboard">
        <section className="global-dashboard__panel global-dashboard__panel--wide global-dashboard__start">
          <h2>Как начать</h2>
          <ol className="global-dashboard__start-list">
            <li>Создай проект или открой демо-спектакль</li>
            <li>Открой сценарий и разбей на сцены</li>
            <li>Собери свет и прогон</li>
            <li>Расставь площадку в 3D</li>
            <li>Поставь репетицию, когда войдёшь в аккаунт</li>
          </ol>
          <Link className="global-dashboard__text-link" to={globalPaths.projects}>
            К проектам
          </Link>
        </section>
      </main>
    );
  }

  if (viewState === "loading" || organizationsLoading || projectsLoading) {
    return <PageBootLoader label="Загрузка обзора…" />;
  }

  if (viewState === "error" || !data) {
    return (
      <main className="global-dashboard global-dashboard--state">
        <p className="global-dashboard__muted">Не удалось загрузить данные.</p>
        <Button variant="secondary" onClick={() => void dashboard.refetch()}>
          Повторить
        </Button>
      </main>
    );
  }

  const showStartGuide = projectItems.length === 0;

  return (
    <main className="global-dashboard">
      {showStartGuide ? (
        <section className="global-dashboard__panel global-dashboard__panel--wide global-dashboard__start">
          <h2>Как начать</h2>
          <ol className="global-dashboard__start-list">
            <li>Создай проект или открой демо-спектакль</li>
            <li>Открой сценарий и разбей на сцены</li>
            <li>Собери свет и прогон</li>
            <li>Расставь площадку в 3D</li>
            <li>Поставь репетицию</li>
          </ol>
          <Link className="global-dashboard__text-link" to={globalPaths.projects}>
            К проектам
          </Link>
        </section>
      ) : null}

      <div className="global-dashboard__grid">
        <section className="global-dashboard__panel">
          <div className="global-dashboard__panel-heading">
            <h2>Недавние организации</h2>
            <Link
              className="global-dashboard__text-link"
              to={globalPaths.organizations}
            >
              Все
            </Link>
          </div>
          {recentOrganizations.length ? (
            <ul className="global-dashboard__list">
              {recentOrganizations.map((organization) => (
                <li key={organization.key}>
                  <Link
                    className="global-dashboard__row"
                    to={organization.path}
                  >
                    <span className="global-dashboard__row-icon">
                      <DashboardIcon name="building" />
                    </span>
                    <span className="global-dashboard__row-body">
                      <span className="global-dashboard__row-title">
                        {organization.title}
                      </span>
                      <span className="global-dashboard__row-meta">
                        {organization.typeLabel}
                      </span>
                    </span>
                    <span className="global-dashboard__row-edited">
                      {formatOpenedAt(organization.openedAt)}
                    </span>
                    <span
                      className="global-dashboard__chevron"
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="building" align="start">
              Нет недавних организаций
            </EmptyState>
          )}
        </section>

        <section className="global-dashboard__panel">
          <h2>Недавние проекты</h2>
          {recentProjects.length ? (
            <ul className="global-dashboard__list">
              {recentProjects.map((project) => {
                const workspaceLabel = project.workspace?.name ?? "Проект";
                return (
                  <li key={project.slug}>
                    <Link
                      className="global-dashboard__row"
                      to={projectPath(project.slug)}
                    >
                      <span className="global-dashboard__row-icon">
                        <DashboardIcon name="building" />
                      </span>
                      <span className="global-dashboard__row-body">
                        <span className="global-dashboard__row-title">
                          {project.name || project.slug}
                        </span>
                        <span className="global-dashboard__row-meta">
                          {workspaceLabel} · Активный
                        </span>
                      </span>
                      <span className="global-dashboard__row-edited">
                        {formatUpdatedAt(project.updatedAt)}
                      </span>
                      <span className="global-dashboard__chevron" aria-hidden="true">
                        ›
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="building" align="start">
              Нет недавних проектов
            </EmptyState>
          )}
        </section>

        <section className="global-dashboard__panel">
          <h2>Ближайшие репетиции</h2>
          {data.rehearsals.length ? (
            <ul className="global-dashboard__list">
              {data.rehearsals.map((rehearsal) => (
                <li key={rehearsal.id}>
                  <Link
                    className="global-dashboard__row"
                    to={projectPath(rehearsal.project.slug, "sessions")}
                  >
                    <span className="global-dashboard__row-body">
                      <span className="global-dashboard__row-title">
                        {rehearsal.title}
                      </span>
                      <span className="global-dashboard__row-meta">
                        {rehearsal.project.name} · {formatDate(rehearsal.startsAt)}
                      </span>
                      {rehearsal.place ? (
                        <span className="global-dashboard__row-meta">
                          {rehearsal.place}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="calendar">
              Нет запланированных репетиций
            </EmptyState>
          )}
        </section>

        <section className="global-dashboard__panel">
          <h2>Мои задачи</h2>
          {data.tasks.length ? (
            <ul className="global-dashboard__list">
              {data.tasks.map((task) => {
                const statusClass = cn(
                  "global-dashboard__status",
                  `global-dashboard__status--${task.status}`,
                );
                return (
                  <li key={task.id}>
                    <Link
                      className="global-dashboard__row"
                      to={projectTaskPath(task.project.slug, task.id)}
                    >
                      <DashboardIcon
                        name="square"
                        className="global-dashboard__check"
                      />
                      <span className="global-dashboard__row-body">
                        <span className="global-dashboard__row-title">
                          {task.title}
                        </span>
                      </span>
                      <span className={statusClass}>
                        <span
                          className="global-dashboard__status-dot"
                          aria-hidden="true"
                        />
                        {taskStatusLabel(task.status)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="square">Нет незавершённых задач</EmptyState>
          )}
        </section>

        <section className="global-dashboard__panel global-dashboard__panel--wide">
          <h2>Требуют внимания</h2>
          {actionError ? (
            <p className="global-dashboard__error" role="alert">
              {actionError}
            </p>
          ) : null}
          {data.actions.length ? (
            <ul className="global-dashboard__actions">
              {data.actions.map((action) => {
                const showMailIcon = isIncomingMailAction(action);
                return (
                  <li key={`${action.kind}:${action.id}`}>
                    <div className="global-dashboard__action-main">
                      {showMailIcon ? (
                        <span className="global-dashboard__row-icon">
                          <DashboardIcon name="mail" />
                        </span>
                      ) : null}
                      <div className="global-dashboard__action-copy">
                        <strong>{action.title}</strong>
                        <span>{formatDate(action.dueAt)}</span>
                      </div>
                    </div>
                    <ActionControls
                      action={action}
                      busy={actionBusy}
                      onOpenInvite={openInvite}
                      onAnswerRehearsal={(rehearsalId, status) =>
                        void runAction(
                          answerRehearsal({ rehearsalId, status }).unwrap(),
                        )
                      }
                      onAnswerSession={(sessionId, response) =>
                        void runAction(
                          answerSession({ sessionId, response }).unwrap(),
                        )
                      }
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="alert">
              Нет элементов, требующих внимания
            </EmptyState>
          )}
        </section>
      </div>

      <DashboardInviteModal
        invite={openedInvite}
        busy={actionBusy}
        error={actionError}
        onClose={() => setOpenedInvite(null)}
        onAccept={() =>
          openedInvite
            ? void runAction(
                answerInvite({
                  kind: openedInvite.kind,
                  inviteId: openedInvite.id,
                  response: "accept",
                }).unwrap(),
              )
            : undefined
        }
        onDecline={() =>
          openedInvite
            ? void runAction(
                answerInvite({
                  kind: openedInvite.kind,
                  inviteId: openedInvite.id,
                  response: "decline",
                }).unwrap(),
              )
            : undefined
        }
      />
    </main>
  );
}
