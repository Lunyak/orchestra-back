import cn from "classnames";
import { Link } from "react-router-dom";
import "./style.css";

export type RehearsalPlanTab = "board" | "sessions" | "tasks";

type RehearsalPlanSectionChromeProps = {
  activeTab: RehearsalPlanTab;
};

export function RehearsalPlanSectionChrome({
  activeTab,
}: RehearsalPlanSectionChromeProps) {
  const isBoardTab = activeTab === "board";
  const isSessionsTab = activeTab === "sessions";
  const isTasksTab = activeTab === "tasks";

  return (
    <div className="rehearsal-plan-chrome">

      <div
        className="rehearsal-plan-tabs"
        role="tablist"
        aria-label="Разделы плана репетиций"
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
          className={cn("rehearsal-plan-tab", isBoardTab && "rehearsal-plan-tab--active")}
        >
          Доска
        </Link>
        <Link
          to="/tasks"
          role="tab"
          aria-selected={isTasksTab}
          className={cn("rehearsal-plan-tab", isTasksTab && "rehearsal-plan-tab--active")}
        >
          Задачи
        </Link>
      </div>
    </div>
  );
}
