import cn from "classnames";
import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  type AdminSection,
  resolveAdminPlanEntryPath,
  writeAdminSection,
} from "../../settings/adminSection";
import "./style.css";

type AdminSectionChromeProps = {
  activeSection: AdminSection;
  sectionTabs?: ReactNode;
  children?: ReactNode;
};

function PlanIcon() {
  return (
    <svg
      className="admin-switch__icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="6" height="16" />
      <rect x="10" y="4" width="6" height="16" />
      <rect x="17" y="4" width="4" height="16" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg
      className="admin-switch__icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg
      className="admin-switch__icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function AccountingIcon() {
  return (
    <svg
      className="admin-switch__icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="5" width="20" height="14" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  );
}

function PremisesIcon() {
  return (
    <svg
      className="admin-switch__icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 21h18" />
      <path d="M5 21V8l7-5 7 5v13" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

export function AdminSectionChrome({
  activeSection,
  sectionTabs,
  children,
}: AdminSectionChromeProps) {
  const isPlanSection = activeSection === "plan";
  const isTeamSection = activeSection === "team";
  const isTasksSection = activeSection === "tasks";
  const isAccountingSection = activeSection === "accounting";
  const isPremisesSection = activeSection === "premises";
  const planEntryPath = resolveAdminPlanEntryPath();

  useEffect(() => {
    writeAdminSection(activeSection);
  }, [activeSection]);

  return (
    <div className="admin-chrome-layout">
      <aside className="admin-chrome">
        <nav
          className="admin-switch"
          role="tablist"
          aria-label="Разделы администрирования"
        >
          <Link
            to={planEntryPath}
            role="tab"
            aria-selected={isPlanSection}
            className={cn(
              "admin-switch__item",
              isPlanSection && "admin-switch__item--active",
            )}
          >
            <PlanIcon />
            <span className="admin-switch__title">Репетиции</span>
          </Link>
          <Link
            to="/troupe"
            role="tab"
            aria-selected={isTeamSection}
            className={cn(
              "admin-switch__item",
              isTeamSection && "admin-switch__item--active",
            )}
          >
            <TeamIcon />
            <span className="admin-switch__title">Команда</span>
          </Link>
          <Link
            to="/tasks"
            role="tab"
            aria-selected={isTasksSection}
            className={cn(
              "admin-switch__item",
              isTasksSection && "admin-switch__item--active",
            )}
          >
            <TasksIcon />
            <span className="admin-switch__title">Задачи</span>
          </Link>
          <Link
            to="/accounting"
            role="tab"
            aria-selected={isAccountingSection}
            className={cn(
              "admin-switch__item",
              isAccountingSection && "admin-switch__item--active",
            )}
          >
            <AccountingIcon />
            <span className="admin-switch__title">Бухгалтерия</span>
          </Link>
          <Link
            to="/premises"
            role="tab"
            aria-selected={isPremisesSection}
            className={cn(
              "admin-switch__item",
              isPremisesSection && "admin-switch__item--active",
            )}
          >
            <PremisesIcon />
            <span className="admin-switch__title">Помещения</span>
          </Link>
        </nav>
        {sectionTabs ? (
          <div className="admin-chrome__sub">{sectionTabs}</div>
        ) : null}
      </aside>
      {children != null ? (
        <div className="admin-chrome-layout__main">{children}</div>
      ) : null}
    </div>
  );
}
