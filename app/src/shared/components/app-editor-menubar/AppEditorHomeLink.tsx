import cn from "classnames";
import { Link, useLocation } from "react-router-dom";
import { globalPaths, isProjectPath } from "../../../app/router/paths";

const globalNavigation = [
  { path: globalPaths.dashboard, label: "Обзор" },
  { path: globalPaths.projects, label: "Проекты" },
  { path: globalPaths.organizations, label: "Организации" },
  {
    path: globalPaths.accounting,
    label: "Бухгалтерия",
    status: "soon" as const,
  },
] as const;

function isNavPathActive(pathname: string, path: string) {
  if (pathname === path || pathname.startsWith(`${path}/`)) return true;
  if (path === globalPaths.organizations) {
    return (
      pathname === globalPaths.studios ||
      pathname.startsWith(`${globalPaths.studios}/`)
    );
  }
  return false;
}

export function AppEditorHomeLink() {
  const location = useLocation();
  const onProjectRoute = isProjectPath(location.pathname);

  if (onProjectRoute) {
    return (
      <nav className="app-editor-menubar__directions" aria-label="Выход из проекта">
        <Link to={globalPaths.projects} className="app-editor-menubar__home">
          ← Проекты
        </Link>
      </nav>
    );
  }

  return (
    <nav className="app-editor-menubar__directions" aria-label="Основная навигация">
      {globalNavigation.map((item) => {
        const { path, label } = item;
        const isSoon = "status" in item && item.status === "soon";
        const isActive = isNavPathActive(location.pathname, path);
        return (
          <Link
            key={path}
            to={path}
            className={cn(
              "app-editor-menubar__home",
              isActive && "app-editor-menubar__home--active",
              isSoon && "app-editor-menubar__home--soon",
            )}
            aria-current={isActive ? "page" : undefined}
            title={isSoon ? "Раздел ещё в разработке" : undefined}
          >
            <span>{label}</span>
            {isSoon ? (
              <span className="app-editor-menubar__home-badge">скоро</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
