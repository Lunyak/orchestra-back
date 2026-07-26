import cn from "classnames";
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
      className={cn(
        "light-plot-mode-tabs",
        hasCenter && "light-plot-mode-tabs--with-center",
      )}
    >
      {hasCenter ? <div className="light-plot-mode-tabs__center">{center}</div> : null}
      {trailing ? <div className="light-plot-mode-tabs__end">{trailing}</div> : null}
    </div>
  );
}
