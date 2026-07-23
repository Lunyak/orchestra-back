import cn from "classnames";
import type { ReactNode } from "react";
import type { TheaterBuiltinTemplateKey } from "../model/theater-model-builtin";
import { THEATER_BUILTIN_TEMPLATES } from "../model/theater-model-builtin";
import { writeTheaterBuiltinTemplateDrag } from "../model/theater-builtin-template-dnd";
import { TheaterBuiltinTemplatePreview } from "./TheaterBuiltinTemplatePreview";

type TheaterBuiltinTemplatePickerProps = {
  value: TheaterBuiltinTemplateKey | undefined;
  onChange: (key: TheaterBuiltinTemplateKey) => void;
  dragEnabled?: boolean;
};

function ThumbSvg({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      className={cn("theater-builtin-template-thumb__svg", className)}
      viewBox="0 0 48 48"
      width="48"
      height="48"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function BuiltinTemplateThumb({ builtin }: { builtin: TheaterBuiltinTemplateKey }) {
  switch (builtin) {
    case "table":
      return (
        <ThumbSvg>
          <rect x="8" y="18" width="32" height="4" fill="currentColor" />
          <rect x="12" y="22" width="3" height="16" fill="currentColor" />
          <rect x="33" y="22" width="3" height="16" fill="currentColor" />
          <rect x="12" y="22" width="24" height="2" opacity="0.45" fill="currentColor" />
        </ThumbSvg>
      );
    case "roundTable":
      return (
        <ThumbSvg>
          <ellipse cx="24" cy="18" rx="14" ry="6" fill="currentColor" />
          <rect x="22" y="20" width="4" height="14" fill="currentColor" />
          <ellipse cx="24" cy="36" rx="7" ry="3" fill="currentColor" opacity="0.55" />
        </ThumbSvg>
      );
    case "chair":
      return (
        <ThumbSvg>
          <rect x="14" y="12" width="4" height="18" fill="currentColor" />
          <rect x="14" y="26" width="20" height="4" fill="currentColor" />
          <rect x="14" y="30" width="3" height="10" fill="currentColor" />
          <rect x="31" y="30" width="3" height="10" fill="currentColor" />
        </ThumbSvg>
      );
    case "sofa":
      return (
        <ThumbSvg>
          <rect x="8" y="16" width="32" height="12" fill="currentColor" />
          <rect x="8" y="12" width="32" height="6" fill="currentColor" opacity="0.7" />
          <rect x="6" y="16" width="5" height="14" fill="currentColor" />
          <rect x="37" y="16" width="5" height="14" fill="currentColor" />
          <rect x="10" y="30" width="4" height="6" fill="currentColor" />
          <rect x="34" y="30" width="4" height="6" fill="currentColor" />
        </ThumbSvg>
      );
    case "bench":
      return (
        <ThumbSvg>
          <rect x="6" y="22" width="36" height="5" fill="currentColor" />
          <rect x="10" y="27" width="3" height="10" fill="currentColor" />
          <rect x="35" y="27" width="3" height="10" fill="currentColor" />
        </ThumbSvg>
      );
    case "cabinet":
      return (
        <ThumbSvg>
          <rect x="12" y="10" width="24" height="28" fill="currentColor" />
          <rect x="14" y="12" width="20" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
          <circle cx="30" cy="24" r="1.5" fill="var(--color-bg, #111)" />
        </ThumbSvg>
      );
    case "blackCube":
      return (
        <ThumbSvg>
          <path d="M12 18 L24 12 L36 18 L36 34 L24 40 L12 34 Z" fill="currentColor" />
          <path d="M24 12 L24 40" stroke="var(--color-bg, #111)" strokeWidth="1" opacity="0.35" />
          <path d="M12 18 L24 24 L36 18" fill="none" stroke="var(--color-bg, #111)" strokeWidth="1" opacity="0.35" />
        </ThumbSvg>
      );
    case "strawGrid":
      return (
        <ThumbSvg>
          <rect x="8" y="8" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 18 H40 M8 28 H40 M18 8 V40 M28 8 V40" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 34 Q18 22 24 30 T36 20" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        </ThumbSvg>
      );
    case "stageActor":
    case "actor":
      return (
        <ThumbSvg>
          <circle cx="24" cy="12" r="5" fill="currentColor" />
          <rect x="18" y="18" width="12" height="14" fill="currentColor" />
          <rect x="16" y="32" width="5" height="10" fill="currentColor" />
          <rect x="27" y="32" width="5" height="10" fill="currentColor" />
          <path d="M14 20 H34" stroke="currentColor" strokeWidth="3" />
        </ThumbSvg>
      );
    case "stageSpotlight":
      return (
        <ThumbSvg>
          <rect x="18" y="6" width="12" height="8" fill="currentColor" />
          <path d="M20 14 L16 28 L32 28 L28 14 Z" fill="currentColor" opacity="0.85" />
          <path d="M16 28 L10 42 L38 42 L32 28 Z" fill="currentColor" opacity="0.25" />
        </ThumbSvg>
      );
    case "lightTruss6m":
      return (
        <ThumbSvg>
          <rect x="4" y="18" width="40" height="6" fill="currentColor" />
          <path
            d="M8 18 V30 M16 18 V30 M24 18 V30 M32 18 V30 M40 18 V30"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M4 24 H44" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        </ThumbSvg>
      );
    case "humanStanding":
    case "humanSmoothStanding":
      return (
        <ThumbSvg className={builtin === "humanSmoothStanding" ? "is-smooth" : undefined}>
          <circle cx="24" cy="10" r="5" fill="currentColor" />
          <rect x="19" y="16" width="10" height="14" fill="currentColor" />
          <rect x="17" y="30" width="5" height="12" fill="currentColor" />
          <rect x="26" y="30" width="5" height="12" fill="currentColor" />
          <rect x="14" y="18" width="4" height="10" fill="currentColor" />
          <rect x="30" y="18" width="4" height="10" fill="currentColor" />
        </ThumbSvg>
      );
    case "humanSitting":
    case "humanSmoothSitting":
      return (
        <ThumbSvg className={builtin === "humanSmoothSitting" ? "is-smooth" : undefined}>
          <circle cx="22" cy="12" r="5" fill="currentColor" />
          <rect x="17" y="18" width="10" height="10" fill="currentColor" />
          <rect x="17" y="28" width="18" height="5" fill="currentColor" />
          <rect x="14" y="33" width="5" height="8" fill="currentColor" />
          <rect x="31" y="28" width="5" height="8" fill="currentColor" />
        </ThumbSvg>
      );
    case "fence":
      return (
        <ThumbSvg>
          <rect x="8" y="10" width="4" height="28" fill="currentColor" />
          <rect x="36" y="10" width="4" height="28" fill="currentColor" />
          <rect x="8" y="16" width="32" height="3" fill="currentColor" />
          <rect x="8" y="26" width="32" height="3" fill="currentColor" />
        </ThumbSvg>
      );
    case "dancer":
      return (
        <ThumbSvg>
          <circle cx="24" cy="10" r="4" fill="currentColor" />
          <path d="M24 14 L18 28 L24 24 L30 28 Z" fill="currentColor" />
          <path d="M18 20 L10 14 M30 20 L38 12" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
          <path d="M20 28 L16 40 M28 28 L34 40" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
        </ThumbSvg>
      );
    default:
      return (
        <ThumbSvg>
          <rect x="12" y="12" width="24" height="24" fill="currentColor" opacity="0.5" />
        </ThumbSvg>
      );
  }
}

export function TheaterBuiltinTemplatePicker({
  value,
  onChange,
  dragEnabled = true,
}: TheaterBuiltinTemplatePickerProps) {
  const previewBuiltin = value ?? THEATER_BUILTIN_TEMPLATES[0].key;

  return (
    <div className="theater-field theater-field--stacked">
      <TheaterBuiltinTemplatePreview builtin={previewBuiltin} />
      <p className="theater-layout-hint theater-builtin-template-picker__hint">
        Перетащите миниатюру на сцену или выберите и нажмите «+ Модель».
      </p>
      <div className="theater-builtin-template-picker" role="listbox" aria-label="Модели">
        {THEATER_BUILTIN_TEMPLATES.map((item) => {
          const selected = value === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="option"
              aria-selected={selected}
              title={item.label}
              draggable={dragEnabled}
              className={cn(
                "theater-builtin-template-picker__item",
                selected && "theater-builtin-template-picker__item--active",
                dragEnabled && "theater-builtin-template-picker__item--draggable",
              )}
              onClick={() => onChange(item.key)}
              onDragStart={(event) => {
                if (!dragEnabled) return;
                onChange(item.key);
                writeTheaterBuiltinTemplateDrag(event.dataTransfer, item.key);
              }}
            >
              <span className="theater-builtin-template-thumb">
                <BuiltinTemplateThumb builtin={item.key} />
              </span>
              <span className="theater-builtin-template-picker__label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
