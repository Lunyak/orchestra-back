import type { ReactNode } from "react";
import type { LightPlotMode } from "../../../features/script-ui/model/script-ui-slice";
import { SCRIPT_MARKDOWN_NOTES_TAB_LABEL } from "../show-script/script-markdown-tab-labels";

export type LightPlotModeTabsProps = {
  mode: LightPlotMode;
  onModeChange: (mode: LightPlotMode) => void;
  onOpenTechCard?: (stepIndex?: number) => void;
  center?: ReactNode;
  trailing?: ReactNode;
};

export function LightPlotModeTabs({
  mode,
  onModeChange,
  onOpenTechCard,
  center = null,
  trailing = null,
}: LightPlotModeTabsProps) {
  const isRehearsal = mode === "rehearsal";
  const isProgRun = mode === "prog-run";

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
        <button
          type="button"
          className="light-plot-mode-tab"
          data-active={isRehearsal ? "true" : undefined}
          aria-pressed={isRehearsal}
          onClick={() => onModeChange("rehearsal")}
        >
          Репетиция
        </button>
        <button
          type="button"
          className="light-plot-mode-tab"
          data-active={isProgRun ? "true" : undefined}
          aria-pressed={isProgRun}
          onClick={() => onModeChange("prog-run")}
        >
          ПРОГОН
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
