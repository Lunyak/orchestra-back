import "@shared/layout/app-shell.css";
import { writeRehearsalPlanTab } from "@shared/settings/rehearsalPlanTab";
import cn from "classnames";
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getProjectSectionFromPath } from "../../../app/router/paths";
import { ProjectRehearsalPlanNav } from "./ProjectRehearsalPlanNav";

export function ProjectOperationsLayout() {
  const { pathname } = useLocation();
  const projectSection = getProjectSectionFromPath(pathname);
  const isRehearsalPlanSection =
    projectSection === "sessions" ||
    projectSection === "tasks" ||
    projectSection === "availability";

  useEffect(() => {
    if (projectSection !== "sessions" && projectSection !== "tasks") return;
    writeRehearsalPlanTab(projectSection);
  }, [isRehearsalPlanSection, projectSection]);

  return (
    <div className={cn("app-layout")}>
      <div className={cn("app-content")}>
        {isRehearsalPlanSection ? <ProjectRehearsalPlanNav /> : null}
        <main className={cn("main-content", "main-content-sessions")}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
