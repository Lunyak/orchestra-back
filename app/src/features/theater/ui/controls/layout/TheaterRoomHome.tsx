import type { ReactNode } from "react";
import {
  THEATER_ROOM_NAV,
  type TheaterRoomSectionId,
} from "../../../model/theater-sidebar-nav";
import type { LayoutSectionProps } from "./types";

type IconProps = {
  children: ReactNode;
};

function NavGlyph({ children }: IconProps) {
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

function RoomSectionIcon({ sectionId }: { sectionId: TheaterRoomSectionId }) {
  if (sectionId === "hall") {
    return (
      <NavGlyph>
        <path d="M3 10.5 12 4l9 6.5" />
        <path d="M5 10.5V20h14v-9.5" />
        <path d="M10 20v-5h4v5" />
      </NavGlyph>
    );
  }
  if (sectionId === "audience") {
    return (
      <NavGlyph>
        <path d="M5 14v4M9 13v5M15 13v5M19 14v4" />
        <path d="M4 14h4l1-3h6l1 3h4" />
      </NavGlyph>
    );
  }
  if (sectionId === "stage") {
    return (
      <NavGlyph>
        <path d="M4 20V8l8-4 8 4v12" />
        <path d="M4 12h16" />
      </NavGlyph>
    );
  }
  if (sectionId === "grid") {
    return (
      <NavGlyph>
        <rect x="3" y="3" width="18" height="18" />
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
      </NavGlyph>
    );
  }
  if (sectionId === "materials") {
    return (
      <NavGlyph>
        <path d="M12 3 4 8.5 12 14l8-5.5L12 3Z" />
        <path d="M4 12.5 12 18l8-5.5" />
      </NavGlyph>
    );
  }
  return (
    <NavGlyph>
      <path d="M12 3v12" />
      <path d="M8 11l4 4 4-4" />
      <path d="M5 19h14" />
    </NavGlyph>
  );
}

export type TheaterRoomHomeProps = LayoutSectionProps & {
  onOpen: (sectionId: TheaterRoomSectionId) => void;
};

export function TheaterRoomHome({ vm, layout, onOpen }: TheaterRoomHomeProps) {
  const metaBySection: Record<TheaterRoomSectionId, string> = {
    hall: layout.layoutHallBadge,
    audience: layout.layoutSeatBadge,
    stage: layout.layoutShapeLabel,
    grid: `${vm.stageGrid.cols}×${vm.stageGrid.rows}`,
    materials: "",
    export: "",
  };

  return (
    <nav className="theater-sidebar-home" aria-label="Помещение">
      <section className="theater-sidebar-home__group">
        {THEATER_ROOM_NAV.map((item) => {
          const meta = metaBySection[item.id];
          return (
            <button
              key={item.id}
              type="button"
              className="theater-sidebar-home__item"
              onClick={() => onOpen(item.id)}
            >
              <RoomSectionIcon sectionId={item.id} />
              <span className="theater-sidebar-home__label">{item.label}</span>
              {meta ? <span className="theater-sidebar-home__meta">{meta}</span> : null}
            </button>
          );
        })}
      </section>
    </nav>
  );
}
