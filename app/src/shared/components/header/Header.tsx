import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { HeaderNav } from "./HeaderNav";
import { HeaderScriptStateNav, type HeaderScriptStateProps } from "./HeaderScriptStateNav";
import "./style.css";

interface HeaderProps {
  projectName?: string;
  sceneName?: string;
  /** Управление состоянием страницы сценария (Шаги, Плейлист, Звуки, Реквизит). Показывается только на маршруте / */
  scriptState?: HeaderScriptStateProps;
}

export const Header: React.FC<HeaderProps> = ({ scriptState }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const isTouchLike = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches ?? false;
    } catch {
      return false;
    }
  }, []);

  // Закрываем панель при смене маршрута
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const toggleNav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((p) => !p);
  };

  return (
    <div className="header-zone header-zone--left">
      <button
        type="button"
        className={`header-sidebar-toggle ${isOpen ? "header-sidebar-toggle--open" : ""}`}
        onClick={toggleNav}
        aria-label={isOpen ? "Скрыть навигацию" : "Открыть навигацию"}
        title={isOpen ? "Скрыть навигацию" : "Навигация"}
        aria-expanded={isOpen}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {isOpen ? (
            <polyline points="14 6 8 12 14 18" />
          ) : (
            <polyline points="10 6 16 12 10 18" />
          )}
        </svg>
      </button>

      {isTouchLike && isOpen ? (
        <div
          className="header-touch-overlay"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      ) : null}

      <header
        className={`header header--left header--slide ${isOpen ? "header--open" : ""}`}
        onClickCapture={(e) => {
          if (!isTouchLike) return;
          const t = e.target as HTMLElement | null;
          if (!t) return;
          if (t.closest?.("button.header-nav-btn")) {
            // Close after the button handles its click (navigation / toggles).
            requestAnimationFrame(() => setIsOpen(false));
          }
        }}
      >
        <HeaderNav />
        {scriptState && (
          <>
            <div className="header-script-state-sep" aria-hidden />
            <HeaderScriptStateNav {...scriptState} />
          </>
        )}
      </header>
    </div>
  );
};
