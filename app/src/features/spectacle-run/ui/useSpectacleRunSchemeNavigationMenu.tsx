import cn from "classnames";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAppEditorViewMenuRender } from "../../../shared/components/app-editor-menubar";
import {
  getProjectNavMap,
  type ProjectNavNode,
} from "../../project/model/project-nav-map";
import { useProject } from "../../project/model/project-context";
import { SPECTACLE_RUN_SCHEME_TABS } from "../model/spectacle-run-scheme-tab";
import { useSpectacleRunSchemeTab } from "../model/spectacle-run-scheme-tab-context";

type ProjectMenuItem = {
  href: string;
  label: string;
};

function uniqueNodeHrefs(node: ProjectNavNode): string[] {
  const hrefs = [
    ...(node.href ? [node.href] : []),
    ...(node.children?.flatMap(uniqueNodeHrefs) ?? []),
  ];
  return [...new Set(hrefs)];
}

function projectMenuItems(node: ProjectNavNode, parentLabel?: string): ProjectMenuItem[] {
  const hrefs = uniqueNodeHrefs(node);
  const label = parentLabel ? `${parentLabel} · ${node.label}` : node.label;

  if (hrefs.length === 1) {
    return [{ href: hrefs[0], label }];
  }

  if (node.href) {
    return [{ href: node.href, label }];
  }

  return node.children?.flatMap((child) => projectMenuItems(child, label)) ?? [];
}

function isProjectMenuItemActive(
  pathname: string,
  search: string,
  href: string,
): boolean {
  const [hrefPath, hrefSearch = ""] = href.split("?");
  const pathMatches = pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
  if (!pathMatches) return false;
  if (!hrefSearch) return true;

  const hrefParams = new URLSearchParams(hrefSearch);
  const locationParams = new URLSearchParams(search);
  return [...hrefParams.entries()].every(
    ([key, value]) => locationParams.get(key) === value,
  );
}

export function useSpectacleRunSchemeNavigationMenu() {
  const { activeTab, setActiveTab } = useSpectacleRunSchemeTab();
  const { projectName, currentProjectDisplayName } = useProject();
  const { pathname, search } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const projectItems = useMemo(() => {
    const navMap = getProjectNavMap(projectName, currentProjectDisplayName);
    return [
      { href: navMap.root.href ?? "", label: "Обзор проекта" },
      ...navMap.branches.flatMap((branch) => projectMenuItems(branch)),
    ].filter((item) => item.href);
  }, [currentProjectDisplayName, projectName]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useAppEditorViewMenuRender(
    "spectacle-run-scheme-navigation",
    30,
    () => (
      <div
        ref={menuRef}
        className={cn(
          "theater-editor-menubar__menu",
          "spectacle-run-navigation",
          isOpen && "theater-editor-menubar__menu--open",
        )}
      >
        <button
          type="button"
          className="theater-editor-menubar__menu-title spectacle-run-navigation__trigger"
          aria-label="Навигация по разделам"
          title="Навигация по разделам"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
        <div
          className="theater-editor-menubar__options spectacle-run-navigation__options"
          role="menu"
        >
          <span className="spectacle-run-navigation__group-title">
            Соседние вкладки
          </span>
          {SPECTACLE_RUN_SCHEME_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="menuitem"
                className={cn(
                  "theater-editor-menubar__option",
                  "spectacle-run-navigation__item",
                  isActive && "theater-editor-menubar__option--active",
                )}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsOpen(false);
                }}
              >
                {tab.label}
              </button>
            );
          })}
          <span className="spectacle-run-navigation__group-title">
            Все разделы проекта
          </span>
          {projectItems.map((item) => {
            const isActive = isProjectMenuItemActive(
              pathname,
              search,
              item.href,
            );
            return (
              <Link
                key={item.href}
                to={item.href}
                role="menuitem"
                className={cn(
                  "theater-editor-menubar__option",
                  "spectacle-run-navigation__item",
                  isActive && "theater-editor-menubar__option--active",
                )}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    ),
    [activeTab, isOpen, pathname, projectItems, search, setActiveTab],
  );
}

export function SpectacleRunSchemeNavigationMenuMount() {
  useSpectacleRunSchemeNavigationMenu();
  return null;
}
