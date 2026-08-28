import cn from "classnames";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  getStudioIdFromPath,
  globalPaths,
  isTheaterOrganizationPath,
  resolveProjectScopedBackPath,
} from "../../../app/router/paths";
import { ENABLE_ACCOUNTING } from "../../../shared/build-features";

const globalNavigation = [
  { path: globalPaths.dashboard, label: "Обзор" },
  { path: globalPaths.projects, label: "Проекты" },
  { path: globalPaths.organizations, label: "Организации" },
  {
    path: globalPaths.accounting,
    label: "Бухгалтерия",
    ...(ENABLE_ACCOUNTING
      ? { enabled: true as const }
      : { status: "soon" as const, enabled: false as const }),
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

type ScopedBackLink = {
  to: string;
  ariaLabel: string;
  title: string;
  navLabel: string;
};

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const el = target.closest(
    "input, textarea, select, [contenteditable='true'], [contenteditable=''], .cm-content, .cm-editor",
  );
  if (!el) return false;
  if (el instanceof HTMLInputElement) {
    const type = el.type;
    if (
      type === "button" ||
      type === "submit" ||
      type === "checkbox" ||
      type === "radio" ||
      type === "file" ||
      type === "hidden"
    ) {
      return false;
    }
    return !el.disabled && !el.readOnly;
  }
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  if (el instanceof HTMLSelectElement) return !el.disabled;
  return true;
}

function resolveScopedBackLink(pathname: string): ScopedBackLink | null {
  const projectBack = resolveProjectScopedBackPath(pathname);
  if (projectBack) {
    const toProjects = projectBack === globalPaths.projects;
    return {
      to: projectBack,
      ariaLabel: toProjects ? "К проектам" : "Назад",
      title: toProjects ? "К проектам" : "Назад",
      navLabel: toProjects ? "Выход из проекта" : "Назад",
    };
  }

  if (isTheaterOrganizationPath(pathname)) {
    return {
      to: globalPaths.organizations,
      ariaLabel: "К организациям",
      title: "К организациям",
      navLabel: "Выход из театра",
    };
  }

  if (getStudioIdFromPath(pathname)) {
    return {
      to: globalPaths.organizations,
      ariaLabel: "К организациям",
      title: "К организациям",
      navLabel: "Выход из студии",
    };
  }

  return null;
}

export function AppEditorHomeLink() {
  const location = useLocation();
  const navigate = useNavigate();
  const scopedBack = resolveScopedBackLink(location.pathname);
  const scopedBackTo = scopedBack?.to;

  useEffect(() => {
    if (!scopedBackTo) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Backspace") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isEditableKeyboardTarget(event.target)) return;
      event.preventDefault();
      navigate(scopedBackTo, { replace: true });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, scopedBackTo]);

  if (scopedBack) {
    return (
      <nav
        className="app-editor-menubar__directions"
        aria-label={scopedBack.navLabel}
      >
        <Link
          to={scopedBack.to}
          replace
          className="app-editor-menubar__home"
          aria-label={scopedBack.ariaLabel}
          title={scopedBack.title}
        >
          ←
        </Link>
      </nav>
    );
  }

  return (
    <nav className="app-editor-menubar__directions" aria-label="Основная навигация">
      {globalNavigation.map((item) => {
        const { path, label } = item;
        const isSoon = "status" in item && item.status === "soon";
        const isEnabled = !("enabled" in item) || item.enabled;
        const isActive = isNavPathActive(location.pathname, path);
        const className = cn(
          "app-editor-menubar__home",
          isActive && "app-editor-menubar__home--active",
          isSoon && "app-editor-menubar__home--soon",
          !isEnabled && "app-editor-menubar__home--disabled",
        );
        const badge = isSoon ? (
          <span className="app-editor-menubar__home-badge">скоро</span>
        ) : null;

        if (!isEnabled) {
          return (
            <span
              key={path}
              className={className}
              title="Раздел ещё в разработке"
              aria-disabled="true"
            >
              <span>{label}</span>
              {badge}
            </span>
          );
        }

        return (
          <Link
            key={path}
            to={path}
            className={className}
            aria-current={isActive ? "page" : undefined}
            title={isSoon ? "Раздел ещё в разработке" : undefined}
          >
            <span>{label}</span>
            {badge}
          </Link>
        );
      })}
    </nav>
  );
}
