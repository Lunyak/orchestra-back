import React, { useState } from "react";
import { HeaderNav } from "./HeaderNav";
import "./style.css";

interface HeaderProps {
  projectName?: string;
  sceneName?: string;
}

const TRIGGER_WIDTH = 12;
const HEADER_PANEL_WIDTH = 56;

export const Header: React.FC<HeaderProps> = () => {
  const [isOpen, setIsOpen] = useState(false);

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
      </header>
    </div>
  );
};

