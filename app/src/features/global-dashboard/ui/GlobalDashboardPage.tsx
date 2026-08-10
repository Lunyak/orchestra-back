import { Button } from "@shared/core/button/Button";
import { Modal } from "@shared/core/modal/Modal";
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
  studioPath,
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
import { resolveDashboardViewState } from "../model/dashboard-view-state";
import { readRecentOrganizations } from "../model/recent-organizations-storage";
import iconAlert from "../assets/icon-alert.png";
import iconBriefcase from "../assets/icon-briefcase.png";
import iconBuilding from "../assets/icon-building.png";
import iconCalendar from "../assets/icon-calendar.png";
import iconCheck from "../assets/icon-check.png";
import iconMail from "../assets/icon-mail.png";
import iconSquare from "../assets/icon-square.png";
import "../../director-sessions/ui/director-sessions.css";
import "./global-dashboard.css";

dayjs.locale("ru");

type DashboardIconName =
  | "briefcase"
  | "calendar"
  | "check"
  | "alert"
  | "mail"
  | "square"
  | "building";

const DASHBOARD_ICON_SRC: Record<DashboardIconName, string> = {
  briefcase: iconBriefcase,
  calendar: iconCalendar,
  check: iconCheck,
  alert: iconAlert,
  mail: iconMail,
  square: iconSquare,
  building: iconBuilding,
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

const SUMMARY_ITEMS: Array<{
  key: "projects" | "upcomingRehearsals" | "openTasks" | "actions" | "unreadChat";
  label: string;
  icon: DashboardIconName;
}> = [
  { key: "projects", label: "Проекты", icon: "briefcase" },
  { key: "upcomingRehearsals", label: "Репетиции", icon: "calendar" },
  { key: "openTasks", label: "Мои задачи", icon: "check" },
  { key: "actions", label: "Требуют внимания", icon: "alert" },
  { key: "unreadChat", label: "Сообщения", icon: "mail" },
];

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

function isInviteAction(action: DashboardAction): action is DashboardInviteAction {
  return (
    action.kind === "studio_invite" ||
    action.kind === "project_invite" ||
    action.kind === "troupe_invite"
  );
}

function inviteDetailLines(action: DashboardInviteAction): string[] {
  const lines = [action.description, `От: ${action.invitedByEmail}`];
  if (action.dueAt) {
    lines.push(`Действует до: ${formatDate(action.dueAt)}`);
  }
  return lines;
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
        path: studioPath(studio.id),
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
  const inviteDetails = openedInvite ? inviteDetailLines(openedInvite) : [];

  const runAction = async (request: Promise<unknown>) => {
    setActionError(null);
    try {
      await request;
      setOpenedInvite(null);
    } catch {
      setActionError("Не удалось выполнить действие. Попробуйте ещё раз.");
    }
  };

  if (viewState === "loading") {
    return (
      <main className="global-dashboard global-dashboard--state" aria-busy="true">
        Загрузка обзора…
      </main>
    );
  }

  if (viewState === "error" || !data) {
    return (
      <main className="global-dashboard global-dashboard--state">
        <h1 className="global-dashboard__title">Обзор</h1>
        <p className="global-dashboard__muted">Не удалось загрузить данные.</p>
        <Button variant="secondary" onClick={() => void dashboard.refetch()}>
          Повторить
        </Button>
      </main>
    );
  }

  return (
    <main className="global-dashboard">
      <header className="global-dashboard__header">
        <h1 className="global-dashboard__title">Обзор</h1>
      </header>

      <section className="global-dashboard__summary" aria-label="Сводка">
        {SUMMARY_ITEMS.map((item) => (
          <article className="global-dashboard__counter" key={item.key}>
            <span className="global-dashboard__counter-icon">
              <DashboardIcon name={item.icon} />
            </span>
            <div>
              <strong>{data.summary[item.key]}</strong>
              <span>{item.label}</span>
            </div>
          </article>
        ))}
      </section>

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
          {organizationsLoading ? (
            <p className="global-dashboard__muted">Загрузка организаций…</p>
          ) : recentOrganizations.length ? (
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
          {projectsLoading ? (
            <p className="global-dashboard__muted">Загрузка проектов…</p>
          ) : recentProjects.length ? (
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
              {data.actions.map((action) => (
                <li key={`${action.kind}:${action.id}`}>
                  <div>
                    <strong>{action.title}</strong>
                    <span>{formatDate(action.dueAt)}</span>
                  </div>
                  <ActionControls
                    action={action}
                    busy={actionBusy}
                    onOpenInvite={setOpenedInvite}
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
              ))}
            </ul>
          ) : (
            <EmptyState icon="alert">
              Нет элементов, требующих внимания
            </EmptyState>
          )}
        </section>
      </div>

      <Modal
        isOpen={openedInvite != null}
        onClose={() => setOpenedInvite(null)}
        ariaLabelledBy="dashboard-invite-title"
        panelClassName="global-dashboard__invite-modal"
      >
        {openedInvite ? (
          <div className="global-dashboard__invite-body">
            <h2 id="dashboard-invite-title">{openedInvite.title}</h2>
            <ul className="global-dashboard__invite-meta">
              {inviteDetails.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div
              className={cn(
                "global-dashboard__action-buttons",
                "global-dashboard__invite-actions",
              )}
            >
              <Button
                variant="secondary"
                disabled={actionBusy}
                onClick={() =>
                  void runAction(
                    answerInvite({
                      kind: openedInvite.kind,
                      inviteId: openedInvite.id,
                      response: "accept",
                    }).unwrap(),
                  )
                }
              >
                Принять
              </Button>
              <Button
                variant="ghost"
                disabled={actionBusy}
                onClick={() =>
                  void runAction(
                    answerInvite({
                      kind: openedInvite.kind,
                      inviteId: openedInvite.id,
                      response: "decline",
                    }).unwrap(),
                  )
                }
              >
                Отклонить
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}
