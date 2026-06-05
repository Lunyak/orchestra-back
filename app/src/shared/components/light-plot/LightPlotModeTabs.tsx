import type { ReactNode } from "react";
import { SCRIPT_MARKDOWN_NOTES_TAB_LABEL } from "../show-script/script-markdown-tab-labels";

export type LightPlotModeTabsProps = {
  onOpenTechCard?: (stepIndex?: number) => void;
  center?: ReactNode;
  trailing?: ReactNode;
};

export function LightPlotModeTabs({
  onOpenTechCard,
  center = null,
  trailing = null,
}: LightPlotModeTabsProps) {
  return (
    <div
      className={[
        "light-plot-mode-tabs",
        center ? "light-plot-mode-tabs--with-center" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="light-plot-mode-tabs__start">
        <button type="button" className="light-plot-mode-tab" data-active="true">
          Репетиция
        </button>
        {onOpenTechCard ? (
          <button
            type="button"
            className="light-plot-mode-tab light-plot-mode-tab--link"
            onClick={() => onOpenTechCard()}
            title={`Открыть ${SCRIPT_MARKDOWN_NOTES_TAB_LABEL} текущего шага в сценарии`}
          >
            {SCRIPT_MARKDOWN_NOTES_TAB_LABEL}
          </button>
        ) : null}
      </div>
      {center ? <div className="light-plot-mode-tabs__center">{center}</div> : null}
      {trailing ? <div className="light-plot-mode-tabs__end">{trailing}</div> : null}
    </div>
  );
}
