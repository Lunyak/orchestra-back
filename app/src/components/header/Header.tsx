import React, { useState, useRef, useEffect } from "react";
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

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

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

  return (
    <div
      className="header-zone header-zone--left"
      style={{ width: isOpen ? TRIGGER_WIDTH + HEADER_PANEL_WIDTH : TRIGGER_WIDTH }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="header-trigger header-trigger--left" aria-hidden />
      <header className={`header header--left header--slide ${isOpen ? "header--open" : ""}`}>
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
