import type { ReactNode } from "react";

export type LightPlotModeTabsProps = {
  center?: ReactNode;
  trailing?: ReactNode;
};

export function LightPlotModeTabs({
  center = null,
  trailing = null,
}: LightPlotModeTabsProps) {
  const hasCenter = Boolean(center);

  return (
    <div
      className={[
        "light-plot-mode-tabs",
        hasCenter ? "light-plot-mode-tabs--with-center" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {hasCenter ? <div className="light-plot-mode-tabs__center">{center}</div> : null}
      {trailing ? <div className="light-plot-mode-tabs__end">{trailing}</div> : null}
    </div>
  );
}
