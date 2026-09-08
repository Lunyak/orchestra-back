import cn from "classnames";
import type { TheaterAudienceLayout } from "../../../../../shared/types/script";
import {
  AUDIENCE_LAYOUT_LABELS,
} from "../../../model/theater-audience-arc";

const LAYOUT_ORDER: TheaterAudienceLayout[] = ["rows", "arc", "surround"];

function LayoutGlyph({ layout }: { layout: TheaterAudienceLayout }) {
  if (layout === "rows") {
    return (
      <path d="M 12 16 H 52 M 12 28 H 52 M 12 40 H 52" />
    );
  }
  if (layout === "arc") {
    return <path d="M 10 18 A 22 26 0 0 0 54 18" />;
  }
  return <path d="M 14 12 A 20 22 0 1 1 50 12" />;
}

type TheaterAudienceLayoutPickerProps = {
  value: TheaterAudienceLayout;
  onChange: (layout: TheaterAudienceLayout) => void;
};

export function TheaterAudienceLayoutPicker({
  value,
  onChange,
}: TheaterAudienceLayoutPickerProps) {
  return (
    <div
      className={cn("theater-shape-picker", "theater-shape-picker--seats")}
      role="radiogroup"
      aria-label="Рассадка"
    >
      {LAYOUT_ORDER.map((layout) => {
        const isActive = layout === value;
        return (
          <button
            key={layout}
            type="button"
            role="radio"
            aria-checked={isActive}
            data-state={isActive ? "active" : undefined}
            className={cn("theater-shape-pick", isActive && "theater-shape-pick--active")}
            onClick={() => onChange(layout)}
          >
            <svg
              viewBox="0 0 64 56"
              className={cn("theater-shape-pick__glyph", "theater-shape-pick__glyph--stroke")}
              aria-hidden
            >
              <LayoutGlyph layout={layout} />
            </svg>
            <span className="theater-shape-pick__label">{AUDIENCE_LAYOUT_LABELS[layout]}</span>
          </button>
        );
      })}
    </div>
  );
}
