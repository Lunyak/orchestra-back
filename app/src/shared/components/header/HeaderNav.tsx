import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ENABLE_3D_THEATER } from "../../build-features";

const navItems: { path: string; label: string; navClass: string; icon: React.ReactNode }[] = [
  {
    path: "/",
    label: "Сценарий",
    navClass: "header-nav-btn--script",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    path: "/theater",
    label: "3D театр",
    navClass: "header-nav-btn--theater",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  // {
  //   path: "/light-plot",
  //   label: "Схема проекторов",
  //   icon: (
  //     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
  //       <rect x="3" y="3" width="7" height="7" />
  //       <rect x="14" y="3" width="7" height="7" />
  //       <rect x="14" y="14" width="7" height="7" />
  //       <rect x="3" y="14" width="7" height="7" />
  //       <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" />
  //       <line x1="17.5" y1="6.5" x2="6.5" y2="17.5" />
  //     </svg>
  //   ),
  // },
  {
    path: "/board",
    label: "Доска",
    navClass: "header-nav-btn--board",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="6" height="16" rx="1" />
        <rect x="10" y="4" width="6" height="16" rx="1" />
        <rect x="17" y="4" width="4" height="16" rx="1" />
      </svg>
    ),
  },
  {
    path: "/sessions",
    label: "Сессии",
    navClass: "header-nav-btn--sessions",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  // {
  //   path: "/actor",
  //   label: "Актёр",
  //   icon: (
  //     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
  //       <path d="M20 21a8 8 0 0 0-16 0" />
  //       <circle cx="12" cy="7" r="4" />
  //       <path d="M9 13.5l-1 3 2.8-1.2L12 18l1.2-2.7L16 16.5l-1-3" />
  //     </svg>
  //   ),
  // },
  {
    path: "/troupe",
    label: "Труппа",
    navClass: "header-nav-btn--troupe",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    path: "/roles",
    label: "Роли",
    navClass: "header-nav-btn--roles",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
        <path d="M3 21h18" />
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

export const HeaderNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname || "/";

  return (
    <nav className="header-nav" aria-label="Навигация">
      {navItems
        .filter((item) => ENABLE_3D_THEATER || item.path !== "/theater")
        .map(({ path, label, navClass, icon }) => {
        const isActive = currentPath === path || (path !== "/" && currentPath.startsWith(path));
        return (
          <button
            key={path}
            type="button"
            className={`header-nav-btn ${navClass} ${isActive ? "active" : ""}`}
            onClick={() => navigate(path)}
            title={label}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="header-nav-icon">{icon}</span>
          </button>
        );
      })}
    </nav>
  );
};
