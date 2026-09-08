import cn from "classnames";
import type { TheaterStageShape } from "../../../../../shared/types/script";
import {
  STAGE_SHAPE_LABELS,
} from "../../../model/theater-stage-geometry";

const SHAPE_ORDER: TheaterStageShape[] = [
  "rectangle",
  "trapezoid",
  "circle",
  "semicircle",
  "t-shape",
  "custom",
];

function ShapeGlyph({ shape }: { shape: TheaterStageShape }) {
  if (shape === "rectangle") {
    return <path d="M 10 12 L 54 12 L 54 44 L 10 44 Z" />;
  }
  if (shape === "trapezoid") {
    return <path d="M 6 12 L 58 12 L 48 44 L 16 44 Z" />;
  }
  if (shape === "circle") {
    return <ellipse cx="32" cy="28" rx="22" ry="16" />;
  }
  if (shape === "semicircle") {
    return <path d="M 10 14 A 22 28 0 0 0 54 14 L 10 14 Z" />;
  }
  if (shape === "t-shape") {
    return (
      <path d="M 6 12 L 58 12 L 58 24 L 42 24 L 42 44 L 22 44 L 22 24 L 6 24 Z" />
    );
  }
  return <path d="M 12 14 L 52 10 L 56 42 L 22 46 Z" />;
}

type TheaterStageShapePickerProps = {
  value: TheaterStageShape;
  onChange: (shape: TheaterStageShape) => void;
};

export function TheaterStageShapePicker({
  value,
  onChange,
}: TheaterStageShapePickerProps) {
  return (
    <div className="theater-shape-picker" role="radiogroup" aria-label="Форма стен">
      {SHAPE_ORDER.map((shape) => {
        const isActive = shape === value;
        return (
          <button
            key={shape}
            type="button"
            role="radio"
            aria-checked={isActive}
            data-state={isActive ? "active" : undefined}
            className={cn("theater-shape-pick", isActive && "theater-shape-pick--active")}
            onClick={() => onChange(shape)}
          >
            <svg viewBox="0 0 64 56" className="theater-shape-pick__glyph" aria-hidden>
              <ShapeGlyph shape={shape} />
            </svg>
            <span className="theater-shape-pick__label">{STAGE_SHAPE_LABELS[shape]}</span>
          </button>
        );
      })}
    </div>
  );
}

type TaperDiagramProps = {
  backWidth: number;
  frontWidth: number;
};

export function TheaterTaperDiagram({ backWidth, frontWidth }: TaperDiagramProps) {
  const maxWidth = Math.max(backWidth, frontWidth, 1);
  const back = 16 + 48 * (backWidth / maxWidth);
  const front = 16 + 48 * (frontWidth / maxWidth);
  const backX = (80 - back) / 2;
  const frontX = (80 - front) / 2;
  const path = `M ${backX} 10 L ${backX + back} 10 L ${frontX + front} 42 L ${frontX} 42 Z`;

  return (
    <div className="theater-taper-diagram">
      <svg viewBox="0 0 80 56" className="theater-taper-diagram__svg" aria-hidden>
        <path d={path} className="theater-shape-preview-stage" />
        <text x="40" y="8" className="theater-taper-diagram__caption">
          задняя стена
        </text>
        <text x="40" y="54" className="theater-taper-diagram__caption">
          зрители
        </text>
      </svg>
    </div>
  );
}
