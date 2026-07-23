import cn from "classnames";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AdminSectionChrome } from "../admin/AdminSectionChrome";
import "./style.css";

export type RehearsalPlanTab = "board" | "sessions";

type RehearsalPlanSectionChromeProps = {
  activeTab: RehearsalPlanTab | "tasks";
  children?: ReactNode;
};

export function RehearsalPlanSectionChrome({
  activeTab,
  children,
}: RehearsalPlanSectionChromeProps) {
  if (activeTab === "tasks") {
    return (
      <AdminSectionChrome activeSection="tasks">{children}</AdminSectionChrome>
    );
  }

  const isBoardTab = activeTab === "board";
  const isSessionsTab = activeTab === "sessions";

  return (
    <AdminSectionChrome
      activeSection="plan"
      sectionTabs={
        <div
          className="rehearsal-plan-tabs"
          role="tablist"
          aria-label="Разделы репетиций"
        >
          <Link
            to="/sessions"
            role="tab"
            aria-selected={isSessionsTab}
            className={cn(
              "rehearsal-plan-tab",
              isSessionsTab && "rehearsal-plan-tab--active",
            )}
          >
            Сессии
          </Link>
          <Link
            to="/board"
            role="tab"
            aria-selected={isBoardTab}
            className={cn(
              "rehearsal-plan-tab",
              isBoardTab && "rehearsal-plan-tab--active",
            )}
          >
            Доска
          </Link>
        </div>
      }
    >
      {children}
    </AdminSectionChrome>
  );
}
