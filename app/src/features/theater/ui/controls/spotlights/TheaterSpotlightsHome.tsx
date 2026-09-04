import type { ReactNode } from "react";
import {
  THEATER_SPOTLIGHTS_NAV,
  type TheaterSpotlightsSectionId,
} from "../../../model/theater-sidebar-nav";
import type { SpotlightsSectionProps } from "./types";

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

function SpotlightsSectionIcon({ sectionId }: { sectionId: TheaterSpotlightsSectionId }) {
  if (sectionId === "regular") {
    return (
      <NavGlyph>
        <path d="M12 3v4M9 7h6l5 13H4L9 7Z" />
      </NavGlyph>
    );
  }
  if (sectionId === "rgb") {
    return (
      <NavGlyph>
        <path d="M12 3v4M9 7h6l5 13H4L9 7Z" />
        <path d="M8 16h8" />
      </NavGlyph>
    );
  }
  if (sectionId === "trusses") {
    return (
      <NavGlyph>
        <path d="M3 8h18M3 16h18M6 8v8M12 8v8M18 8v8" />
      </NavGlyph>
    );
  }
  return (
    <NavGlyph>
      <rect x="4" y="5" width="7" height="6" />
      <rect x="13" y="5" width="7" height="6" />
      <rect x="4" y="13" width="7" height="6" />
      <rect x="13" y="13" width="7" height="6" />
    </NavGlyph>
  );
}

export type TheaterSpotlightsHomeProps = Pick<SpotlightsSectionProps, "vm" | "spot"> & {
  onOpen: (sectionId: TheaterSpotlightsSectionId) => void;
};

export function TheaterSpotlightsHome({ vm, spot, onOpen }: TheaterSpotlightsHomeProps) {
  const trussCount = vm.models.filter((model) => model.builtin === "lightTruss6m").length;
  const countBySection: Record<TheaterSpotlightsSectionId, string> = {
    regular: spot.regularSpotlights.length > 0 ? String(spot.regularSpotlights.length) : "нет",
    rgb: spot.rgbSpotlights.length > 0 ? String(spot.rgbSpotlights.length) : "нет",
    trusses: trussCount > 0 ? String(trussCount) : "нет",
    control: spot.spotlightCountBadge,
  };

  return (
    <nav className="theater-sidebar-home" aria-label="Софиты">
      <section className="theater-sidebar-home__group">
        {THEATER_SPOTLIGHTS_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className="theater-sidebar-home__item"
            onClick={() => onOpen(item.id)}
          >
            <SpotlightsSectionIcon sectionId={item.id} />
            <span className="theater-sidebar-home__label">{item.label}</span>
            <span className="theater-sidebar-home__meta">{countBySection[item.id]}</span>
          </button>
        ))}
      </section>
    </nav>
  );
}
