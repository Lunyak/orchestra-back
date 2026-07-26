import type { ReactNode } from "react";
import {
  isSpectacleCreativePath,
  isTheaterRouteEnabled,
  SPECTACLE_HUB_ROUTE_PATH,
  SUFER_ROUTE_PATH,
} from "../../../app/router/routeMeta";
import {
  isAdminAccountingPath,
  isAdminPlanPath,
  isAdminPremisesPath,
  isAdminTasksPath,
  isAdminTeamPath,
  resolveAdminPlanEntryPath,
} from "../../settings/adminSection";

export type HeaderNavSubItem = {
  id: string;
  path: string;
  label: string;
  resolvePath?: () => string;
  isActive: (pathname: string) => boolean;
};

export type HeaderNavItem = {
  path: string;
  label: string;
  navClass: string;
  icon: ReactNode;
  children?: HeaderNavSubItem[];
};

/** Идентификатор пункта «Администрирование»; фактический URL — resolveAdminEntryPath(). */
export const ADMIN_NAV_PATH = "/admin";

/** @deprecated Используйте ADMIN_NAV_PATH */
export const REHEARSAL_PLAN_NAV_PATH = ADMIN_NAV_PATH;

export const ADMIN_NAV_CHILDREN: HeaderNavSubItem[] = [
  {
    id: "plan",
    path: "/sessions",
    label: "Репетиции",
    resolvePath: resolveAdminPlanEntryPath,
    isActive: isAdminPlanPath,
  },
  {
    id: "team",
    path: "/troupe",
    label: "Команда",
    isActive: isAdminTeamPath,
  },
  {
    id: "tasks",
    path: "/tasks",
    label: "Задачи",
    isActive: isAdminTasksPath,
  },
  {
    id: "accounting",
    path: "/accounting",
    label: "Бухгалтерия",
    isActive: isAdminAccountingPath,
  },
  {
    id: "premises",
    path: "/premises",
    label: "Помещения",
    isActive: isAdminPremisesPath,
  },
];

export function isStudioPath(pathname: string) {
  return pathname === "/studio" || pathname.startsWith("/studio/");
}

export function isSpectacleScriptPath(pathname: string) {
  return pathname === "/";
}

export function isSpectacleLightPlotPath(pathname: string) {
  return pathname === "/light-plot";
}

export function isSpectacleSuferPath(pathname: string) {
  return pathname === SUFER_ROUTE_PATH;
}

export function isSpectacleTheaterPath(pathname: string) {
  return isTheaterRouteEnabled() && pathname === "/theater";
}

export const SPECTACLE_NAV_CHILDREN: HeaderNavSubItem[] = [
  {
    id: "script",
    path: "/",
    label: "Сценарий",
    isActive: isSpectacleScriptPath,
  },
  {
    id: "light-plot",
    path: "/light-plot",
    label: "Техчасть",
    isActive: isSpectacleLightPlotPath,
  },
  {
    id: "sufer",
    path: SUFER_ROUTE_PATH,
    label: "Суфлер",
    isActive: isSpectacleSuferPath,
  },
  {
    id: "theater",
    path: "/theater",
    label: "3D театр",
    isActive: isSpectacleTheaterPath,
  },
];

export const HEADER_NAV_ITEMS: HeaderNavItem[] = [
  {
    path: SPECTACLE_HUB_ROUTE_PATH,
    label: "Спектакль",
    navClass: "header-nav-btn--spectacle",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
        <circle cx="15" cy="15" r="2" />
      </svg>
    ),
    children: SPECTACLE_NAV_CHILDREN,
  },
  {
    path: ADMIN_NAV_PATH,
    label: "Администрирование",
    navClass: "header-nav-btn--admin",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    children: ADMIN_NAV_CHILDREN,
  },
  {
    path: "/trainers",
    label: "Тренажёры",
    navClass: "header-nav-btn--trainers",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
        <path d="M8 6h8" />
        <path d="M8 10h6" />
        <path d="M8 14h7" />
      </svg>
    ),
  },
  {
    path: "/studio",
    label: "Студия",
    navClass: "header-nav-btn--studio",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V2z" />
        <path d="M8 7h8" />
        <path d="M8 11h5" />
        <circle cx="16" cy="17" r="2" />
        <path d="M8 17h4" />
      </svg>
    ),
  },
  {
    path: "/profile",
    label: "Профиль",
    navClass: "header-nav-btn--profile",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    path: "/settings",
    label: "Настройки",
    navClass: "header-nav-btn--settings",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export function isHeaderNavItemActive(path: string, currentPath: string) {
  if (path === SPECTACLE_HUB_ROUTE_PATH) {
    return isSpectacleCreativePath(currentPath);
  }
  if (path === ADMIN_NAV_PATH) {
    return (
      currentPath === "/admin" ||
      isAdminPlanPath(currentPath) ||
      isAdminTasksPath(currentPath) ||
      isAdminTeamPath(currentPath) ||
      isAdminAccountingPath(currentPath) ||
      isAdminPremisesPath(currentPath)
    );
  }
  if (path === "/studio") {
    return isStudioPath(currentPath);
  }
  return currentPath === path || (path !== "/" && currentPath.startsWith(path));
}

export function filterHeaderNavItems(items: HeaderNavItem[]) {
  const theaterEnabled = isTheaterRouteEnabled();
  return items.map((item) => {
    if (item.path !== SPECTACLE_HUB_ROUTE_PATH || !item.children?.length) {
      return item;
    }
    if (theaterEnabled) return item;
    return {
      ...item,
      children: item.children.filter((child) => child.id !== "theater"),
    };
  });
}
