import cn from "classnames";
import type { TheaterLayout } from "../../../shared/types/script";
import {
  resolveStageGeometry,
  resolveStageShape,
  STAGE_SHAPE_LABELS,
} from "../model/theater-stage-geometry";

type TheaterStageLayoutGuideProps = {
  layout: TheaterLayout;
  compact?: boolean;
};

function ShapePreview({ shape }: { shape: "rectangle" | "trapezoid" | "t-shape" | "circle" | "semicircle" | "custom" }) {
  const hall = "M 4 6 L 76 6 L 76 54 L 4 54 Z";
  if (shape === "custom") {
    return (
      <svg viewBox="0 0 80 60" className="theater-shape-preview" aria-hidden>
        <path d={hall} className="theater-shape-preview-hall" />
        <path
          d="M 14 16 L 62 12 L 68 44 L 28 48 Z"
          className="theater-shape-preview-stage"
        />
        <line x1="28" y1="48" x2="68" y2="44" className="theater-shape-preview-audience" />
      </svg>
    );
  }
  if (shape === "rectangle") {
    return (
      <svg viewBox="0 0 80 60" className="theater-shape-preview" aria-hidden>
        <path d={hall} className="theater-shape-preview-hall" />
        <path d="M 12 14 L 68 14 L 68 46 L 12 46 Z" className="theater-shape-preview-stage" />
        <line x1="12" y1="46" x2="68" y2="46" className="theater-shape-preview-audience" />
      </svg>
    );
  }
  if (shape === "trapezoid") {
    return (
      <svg viewBox="0 0 80 60" className="theater-shape-preview" aria-hidden>
        <path d={hall} className="theater-shape-preview-hall" />
        <path d="M 8 14 L 72 14 L 58 46 L 22 46 Z" className="theater-shape-preview-stage" />
        <line x1="22" y1="46" x2="58" y2="46" className="theater-shape-preview-audience" />
      </svg>
    );
  }
  if (shape === "circle") {
    return (
      <svg viewBox="0 0 80 60" className="theater-shape-preview" aria-hidden>
        <path d={hall} className="theater-shape-preview-hall" />
        <ellipse cx="40" cy="30" rx="26" ry="16" className="theater-shape-preview-stage" />
        <line x1="22" y1="46" x2="58" y2="46" className="theater-shape-preview-audience" />
      </svg>
    );
  }
  if (shape === "semicircle") {
    return (
      <svg viewBox="0 0 80 60" className="theater-shape-preview" aria-hidden>
        <path d={hall} className="theater-shape-preview-hall" />
        <path
          d="M 16 16 A 24 30 0 0 0 64 16 L 16 16 Z"
          className="theater-shape-preview-stage"
        />
        <path d="M 18 40 A 22 16 0 0 0 62 40" className="theater-shape-preview-audience" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 80 60" className="theater-shape-preview" aria-hidden>
      <path d={hall} className="theater-shape-preview-hall" />
      <path
        d="M 4 14 L 76 14 L 76 28 L 58 28 L 58 46 L 22 46 L 22 28 L 4 28 Z"
        className="theater-shape-preview-stage"
      />
      <line x1="22" y1="46" x2="58" y2="46" className="theater-shape-preview-audience" />
    </svg>
  );
}

export function TheaterStageLayoutGuide({ layout, compact = false }: TheaterStageLayoutGuideProps) {
  const shape = resolveStageShape(layout);
  const geom = resolveStageGeometry(layout);
  const sameWidth = Math.abs(geom.stageBackWidth - geom.prosceniumWidth) < 0.05;

  return (
    <div className={cn("theater-stage-layout-guide", compact && "theater-stage-layout-guide--compact")}>
      <div className="theater-stage-layout-guide-preview">
        <ShapePreview shape={shape} />
        <div className="theater-stage-layout-guide-caption">
          <strong>{STAGE_SHAPE_LABELS[shape]}</strong>
          {!compact && shape === "rectangle" ? (
            <span>Стены параллельны, без сужения к залу.</span>
          ) : !compact && shape === "custom" ? (
            <span>
              Вершины на плане — линия стен; можно весь периметр зала или только сцену. К зрителям —
              без стены.
            </span>
          ) : !compact && shape === "trapezoid" ? (
            <span>
              Задняя стена {geom.stageBackWidth} м, у зрителей {geom.prosceniumWidth} м
            </span>
          ) : !compact && shape === "circle" ? (
            <span>Эллипс {geom.stageBackWidth} м в ширину</span>
          ) : !compact && shape === "semicircle" ? (
            <span>Орхестра {geom.stageBackWidth} м, полукруг к залу</span>
          ) : !compact ? (
            <span>
              Крылья {geom.stageBackWidth}, «ножка» {geom.prosceniumWidth}
            </span>
          ) : null}
        </div>
      </div>

      {!compact ? (
        <>
          <div className="theater-stage-layout-guide-note">
            <p>
              <strong>Серый прямоугольник на плане — весь зал</strong> (поля «Ширина» и «Глубина»).
              Он всегда прямоугольный — это габарит помещения и рядов кресел.
            </p>
            <p>
              <strong>Коричневый контур — стены по вашему полигону</strong> (часто весь зал по серому
              прямоугольнику, можно и только сцену). «Подогнать зал и контур» вписывает полигон в
              габариты зала, а не в маленькую трапецию сцены.
            </p>
            {sameWidth && shape !== "rectangle" ? (
              <p className="theater-stage-layout-guide-warn">
                Сейчас ширина у задней стены и у зала одинаковые — контур почти не отличить от
                прямоугольника. Разведите эти два числа (например 12 м и 8 м).
              </p>
            ) : null}
          </div>
          <ul className="theater-stage-layout-guide-legend">
            <li>
              <span className="theater-stage-layout-guide-swatch theater-stage-layout-guide-swatch--hall" />
              Зал (весь прямоугольник)
            </li>
            <li>
              <span className="theater-stage-layout-guide-swatch theater-stage-layout-guide-swatch--stage" />
              Сцена (контур + стены)
            </li>
            <li>
              <span className="theater-stage-layout-guide-swatch theater-stage-layout-guide-swatch--audience" />
              Граница зала / кресла
            </li>
            <li>
              <span className="theater-stage-layout-guide-swatch theater-stage-layout-guide-swatch--recess" />
              Ниша (углубление в стену)
            </li>
            <li>
              <span className="theater-stage-layout-guide-swatch theater-stage-layout-guide-swatch--door" />
              Дверь (проём)
            </li>
          </ul>
        </>
      ) : null}
    </div>
  );
}
