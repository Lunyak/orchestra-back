import cn from "classnames";
import { type ReactNode } from "react";
import { useAppSelector } from "../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import { usePlaybook } from "../../playbook";
import { useProject } from "../../project/model/project-context";
import { useSpectacleRun } from "../../spectacle-run/model/useSpectacleRun";
import { SpectacleRunProvider, useSpectacleRunContext } from "../../spectacle-run/model/spectacle-run-context";
import {
  SpectacleRunSchemeTabProvider,
  useSpectacleRunSchemeTab,
} from "../../spectacle-run/model/spectacle-run-scheme-tab-context";
import { SPECTACLE_RUN_SCHEME_TABS } from "../../spectacle-run/model/spectacle-run-scheme-tab";
import { SpectacleRunRequisitesPanel } from "../../spectacle-run/ui/SpectacleRunRequisitesPanel";
import { SpectacleRunProjectorPanel } from "../../projector/ui/SpectacleRunProjectorPanel";
import "../../spectacle-run/ui/style.css";
import "./theater-scheme-tabs.css";

export type TheaterSchemeTabId = "light" | "requisites" | "video" | "projector";

type TheaterSchemeTabsBodyProps = {
  children: ReactNode;
};

function TheaterSchemeTabsBody({ children }: TheaterSchemeTabsBodyProps) {
  const run = useSpectacleRunContext();
  const { activeTab, setActiveTab } = useSpectacleRunSchemeTab();
  const showLight = activeTab === "light";

  const panel =
    activeTab === "requisites" ? (
      <SpectacleRunRequisitesPanel
        scene={run.currentScene}
        tapeItem={run.currentItem}
      />
    ) : activeTab === "video" ? (
      <SpectacleRunProjectorPanel mode="video" />
    ) : activeTab === "projector" ? (
      <SpectacleRunProjectorPanel mode="projector" />
    ) : null;

  return (
    <div className="theater-scheme-tabs-shell">
      <div
        className="spectacle-run-scheme__tabs"
        role="tablist"
        aria-label="Разделы спектакля"
      >
        {SPECTACLE_RUN_SCHEME_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={cn(
                "spectacle-run-scheme__tab",
                isActive && "spectacle-run-scheme__tab--active",
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {showLight ? (
        children
      ) : (
        <div
          className="theater-scheme-tabs-panel spectacle-run-scheme__tab-panel"
          role="tabpanel"
        >
          {panel}
        </div>
      )}
    </div>
  );
}

export type TheaterSchemeTabsProps = {
  children: ReactNode;
};

/** Вкладки spectacle-run-scheme поверх 3D-театра (Свет / Реквизит / Видео / Проектор). */
export function TheaterSchemeTabs({ children }: TheaterSchemeTabsProps) {
  const { projectName } = useProject();
  const { scenes } = usePlaybook();
  const { lightChannels } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName ?? "", "script"),
  );
  const run = useSpectacleRun({
    projectName: projectName ?? "",
    scenes,
    lightChannels,
  });

  return (
    <SpectacleRunProvider value={run}>
      <SpectacleRunSchemeTabProvider>
        <TheaterSchemeTabsBody>{children}</TheaterSchemeTabsBody>
      </SpectacleRunSchemeTabProvider>
    </SpectacleRunProvider>
  );
}
