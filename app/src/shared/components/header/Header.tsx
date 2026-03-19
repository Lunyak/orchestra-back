import React, { useEffect, useMemo, useRef, useState } from "react";
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

const TRIGGER_WIDTH = 12;
const HEADER_PANEL_WIDTH = 56;
const CLOSE_DELAY_MS = 300;

export const Header: React.FC<HeaderProps> = ({ scriptState }) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const location = useLocation();

  const isTouchLike = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches ?? false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Закрываем панель при смене маршрута
  useEffect(() => {
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(false);
  }, [location.pathname]);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
      closeTimeoutRef.current = null;
    }, CLOSE_DELAY_MS);
  };

  const triggerWidth = isTouchLike ? 20 : TRIGGER_WIDTH;

  return (
    <div
      className="header-zone header-zone--left"
      style={{ width: isOpen ? triggerWidth + HEADER_PANEL_WIDTH : triggerWidth }}
      onMouseEnter={isTouchLike ? undefined : handleMouseEnter}
      onMouseLeave={isTouchLike ? undefined : handleMouseLeave}
    >
      {isTouchLike ? (
        <button
          type="button"
          className="header-mobile-toggle"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((p) => !p);
          }}
          aria-label={isOpen ? "Скрыть навигацию" : "Открыть навигацию"}
          title={isOpen ? "Скрыть навигацию" : "Навигация"}
          aria-pressed={isOpen}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
      ) : null}

      {isTouchLike && isOpen ? (
        <div
          className="header-touch-overlay"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      ) : null}

      <button
        type="button"
        className="header-trigger header-trigger--left"
        onClick={
          isTouchLike
            ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen((p) => !p);
            }
            : undefined
        }
        aria-label={isOpen ? "Скрыть навигацию" : "Открыть навигацию"}
      />
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
