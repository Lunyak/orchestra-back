import type { ReactNode } from "react";
import {
  THEATER_SIDEBAR_GROUPS,
  type TheaterSidebarPanelId,
} from "../model/theater-sidebar-nav";

type IconProps = {
  children: ReactNode;
};

function SidebarGlyph({ children }: IconProps) {
  return (
    <svg
      className="theater-sidebar-home__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function TheaterSidebarPanelIcon({ panelId }: { panelId: TheaterSidebarPanelId }) {
  if (panelId === "scene") {
    return (
      <SidebarGlyph>
        <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
      </SidebarGlyph>
    );
  }
  if (panelId === "view") {
    return (
      <SidebarGlyph>
        <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
        <circle cx="12" cy="12" r="2.5" />
      </SidebarGlyph>
    );
  }
  if (panelId === "spotlights") {
    return (
      <SidebarGlyph>
        <path d="M12 3v4M9 7h6l5 13H4L9 7Z" />
      </SidebarGlyph>
    );
  }
  if (panelId === "models") {
    return (
      <SidebarGlyph>
        <path d="M12 3l8.5 5v8L12 21 3.5 16V8L12 3Z" />
        <path d="M12 13v8M3.5 8L12 13l8.5-5" />
      </SidebarGlyph>
    );
  }
  if (panelId === "decor") {
    return (
      <SidebarGlyph>
        <rect x="3" y="5" width="18" height="14" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="M3 16l5-5 4 4 3-3 6 6" />
      </SidebarGlyph>
    );
  }
  if (panelId === "layout") {
    return (
      <SidebarGlyph>
        <rect x="3" y="3" width="18" height="18" />
        <path d="M3 12h18M12 3v18" />
      </SidebarGlyph>
    );
  }
  return (
    <SidebarGlyph>
      <rect x="3" y="7" width="18" height="11" />
      <path d="M7 11h.01M11 11h.01M15 11h.01M9 15h6" />
    </SidebarGlyph>
  );
}

export type TheaterSidebarHomeProps = {
  onOpen: (panelId: TheaterSidebarPanelId) => void;
};

export function TheaterSidebarHome({ onOpen }: TheaterSidebarHomeProps) {
  return (
    <nav className="theater-sidebar-home" aria-label="Панели театра">
      {THEATER_SIDEBAR_GROUPS.map((group) => (
        <section key={group.id} className="theater-sidebar-home__group">
          <span className="theater-sidebar-home__group-title">{group.title}</span>
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="theater-sidebar-home__item"
              onClick={() => onOpen(item.id)}
            >
              <TheaterSidebarPanelIcon panelId={item.id} />
              <span className="theater-sidebar-home__label">{item.label}</span>
            </button>
          ))}
        </section>
      ))}
    </nav>
  );
}

export type TheaterSidebarPanelHeaderProps = {
  title: string;
  onBack: () => void;
};

export function TheaterSidebarPanelHeader({
  title,
  onBack,
}: TheaterSidebarPanelHeaderProps) {
  return (
    <div className="theater-sidebar-panel-header">
      <button
        type="button"
        className="theater-sidebar-panel-header__back"
        onClick={onBack}
        title="К списку панелей"
        aria-label="Назад к списку панелей"
      >
        <svg
          className="theater-sidebar-panel-header__back-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <span className="theater-sidebar-panel-header__title">{title}</span>
    </div>
  );
}
