import React, { useState } from "react";
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

export const Header: React.FC<HeaderProps> = ({ scriptState }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isSpectacleRoute =
    location.pathname === "/" ||
    location.pathname === "/theater" ||
    location.pathname === "/light-plot";

  return (
    <div
      className="header-zone header-zone--left"
      style={{ width: isOpen ? TRIGGER_WIDTH + HEADER_PANEL_WIDTH : TRIGGER_WIDTH }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className="header-trigger header-trigger--left" aria-hidden />
      <header className={`header header--left header--slide ${isOpen ? "header--open" : ""}`}>
        <HeaderNav />
        {isSpectacleRoute && scriptState && (
          <>
            <div className="header-script-state-sep" aria-hidden />
            <HeaderScriptStateNav {...scriptState} />
          </>
        )}
      </header>
    </div>
  );
};

