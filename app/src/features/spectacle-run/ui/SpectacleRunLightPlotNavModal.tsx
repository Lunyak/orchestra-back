import cn from "classnames";
import { useId } from "react";
import { Modal } from "../../../shared/core/modal/Modal";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import {
  scriptUiActions,
  type LightPlotMode,
} from "../../script-ui/model/script-ui-slice";
import { useSpectacleRunSchemeTab } from "../model/spectacle-run-scheme-tab-context";
import {
  SPECTACLE_RUN_LIGHT_PLOT_MODES,
  SPECTACLE_RUN_SCHEME_TABS,
  type SpectacleRunSchemeTabId,
} from "../model/spectacle-run-scheme-tab";
import "./spectacle-run-light-plot-nav-modal.css";

type SpectacleRunLightPlotNavModalProps = {
  isOpen: boolean;
  onClose: () => void;
  showSchemeTabs: boolean;
};

export function SpectacleRunLightPlotNavButton({
  showSchemeTabs,
  onOpen,
}: {
  showSchemeTabs: boolean;
  onOpen: () => void;
}) {
  const lightPlotMode = useAppSelector((state) => state.scriptUi.lightPlotMode);
  const { activeTab } = useSpectacleRunSchemeTab();
  const modeLabel =
    SPECTACLE_RUN_LIGHT_PLOT_MODES.find((item) => item.id === lightPlotMode)
      ?.label ?? "Сборка";
  const tabLabel =
    SPECTACLE_RUN_SCHEME_TABS.find((item) => item.id === activeTab)?.label ??
    "Свет";
  const navSummary = showSchemeTabs ? `${modeLabel} · ${tabLabel}` : modeLabel;

  return (
    <button
      type="button"
      className="spectacle-run__light-plot-nav-btn"
      title={`Навигация: ${navSummary}`}
      aria-label={`Навигация: ${navSummary}`}
      onClick={onOpen}
    >
      {navSummary}
    </button>
  );
}

export function SpectacleRunLightPlotNavModal({
  isOpen,
  onClose,
  showSchemeTabs,
}: SpectacleRunLightPlotNavModalProps) {
  const titleId = useId();
  const dispatch = useAppDispatch();
  const lightPlotMode = useAppSelector((state) => state.scriptUi.lightPlotMode);
  const { activeTab, setActiveTab } = useSpectacleRunSchemeTab();

  const selectMode = (mode: LightPlotMode) => {
    dispatch(scriptUiActions.setLightPlotMode({ mode }));
  };

  const selectSchemeTab = (tabId: SpectacleRunSchemeTabId) => {
    setActiveTab(tabId);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="spectacle-run-light-plot-nav-modal__panel"
      ariaLabelledBy={titleId}
    >
      <div className="spectacle-run-light-plot-nav-modal">
        <h2 id={titleId} className="spectacle-run-light-plot-nav-modal__title">
          Навигация
        </h2>

        <section
          className="spectacle-run-light-plot-nav-modal__section"
          aria-label="Режим техчасти"
        >
          <h3 className="spectacle-run-light-plot-nav-modal__section-title">
            Режим
          </h3>
          <ul className="spectacle-run-light-plot-nav-modal__list">
            {SPECTACLE_RUN_LIGHT_PLOT_MODES.map(({ id, label }) => {
              const isActive = lightPlotMode === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={cn(
                      "spectacle-run-light-plot-nav-modal__item",
                      isActive && "spectacle-run-light-plot-nav-modal__item--active",
                    )}
                    aria-pressed={isActive}
                    onClick={() => selectMode(id)}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {showSchemeTabs ? (
          <section
            className="spectacle-run-light-plot-nav-modal__section"
            aria-label="Раздел схемы"
          >
            <h3 className="spectacle-run-light-plot-nav-modal__section-title">
              Раздел
            </h3>
            <ul className="spectacle-run-light-plot-nav-modal__list">
              {SPECTACLE_RUN_SCHEME_TABS.map(({ id, label }) => {
                const isActive = activeTab === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={cn(
                        "spectacle-run-light-plot-nav-modal__item",
                        isActive && "spectacle-run-light-plot-nav-modal__item--active",
                      )}
                      aria-selected={isActive}
                      onClick={() => selectSchemeTab(id)}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
