import { useState, type ReactNode } from "react";
import cn from "classnames";
import type { TheaterMobileSheet } from "../model/theater-mobile-layout";
import {
  downloadTheaterMobileSnapshot,
  serializeTheaterMobileSnapshot,
  theaterMobileSaveKey,
} from "../model/theater-mobile-snapshot";
import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import { TheaterControlsLayoutTab } from "./controls/TheaterControlsLayoutTab";

export type TheaterMobileActionBarProps = {
  vm: TheaterSceneViewModel;
  onTogglePanels?: () => void;
  isPanelsSwapped?: boolean;
};

export function TheaterMobileActionBar({
  vm,
  onTogglePanels,
  isPanelsSwapped,
}: TheaterMobileActionBarProps) {
  const [sheet, setSheet] = useState<TheaterMobileSheet | null>(null);
  const [saveMessage, setSaveMessage] = useState("Автосохранение активно");

  const selectedTitle = vm.activeModel
    ? vm.activeModel.name
    : vm.activeSpotlight
      ? vm.activeSpotlight.label
      : vm.currentScene?.title || "Театр";

  const sheetTitle =
    sheet === "view"
      ? "Вид"
      : sheet === "objects"
        ? "Объекты"
        : sheet === "scene"
          ? "Сцена"
          : "Сохранить театр";

  const isLayoutSheet = sheet === "scene" && vm.activeTab === "layout";

  const openSheet = (next: TheaterMobileSheet) => {
    setSheet((current) => (current === next ? null : next));
  };

  const saveLocalSnapshot = () => {
    try {
      localStorage.setItem(
        theaterMobileSaveKey(vm.projectName),
        serializeTheaterMobileSnapshot(vm),
      );
      setSaveMessage("Снимок театра сохранён на устройстве");
    } catch {
      setSaveMessage("Не удалось сохранить на устройстве");
    }
  };

  const copySnapshotJson = async () => {
    try {
      await navigator.clipboard.writeText(serializeTheaterMobileSnapshot(vm));
      setSaveMessage("JSON театра скопирован");
    } catch {
      setSaveMessage("Не удалось скопировать JSON");
    }
  };

  const downloadSnapshotJson = () => {
    try {
      downloadTheaterMobileSnapshot(vm);
      setSaveMessage("JSON театра сохранён файлом");
    } catch {
      setSaveMessage("Не удалось сохранить файл");
    }
  };

  return (
    <div className="theater-mobile-actions" aria-label="Мобильные действия театра">
      <div className="theater-mobile-actions__status">
        <span>{selectedTitle}</span>
        <strong>{saveMessage}</strong>
      </div>
      {sheet ? (
        <section
          className={cn("theater-mobile-sheet", isLayoutSheet && "theater-mobile-sheet--layout")}
          aria-label="Быстрые действия"
        >
          <header className="theater-mobile-sheet__header">
            <strong>{sheetTitle}</strong>
            <button type="button" onClick={() => setSheet(null)}>
              Закрыть
            </button>
          </header>
          {sheet === "view" ? (
            <div className="theater-mobile-sheet__grid">
              <MobileActionButton
                active={vm.showFloorPlan}
                onClick={() => vm.setShowFloorPlan(!vm.showFloorPlan)}
              >
                2D план
              </MobileActionButton>
              <MobileActionButton
                active={vm.showSeats}
                onClick={() => vm.setShowSeats(!vm.showSeats)}
              >
                Кресла
              </MobileActionButton>
              <MobileActionButton
                active={vm.showGrid}
                onClick={() => vm.setShowGrid(!vm.showGrid)}
              >
                Сетка
              </MobileActionButton>
              <MobileActionButton
                active={!vm.wallsHidden}
                onClick={() => vm.setWallsHidden(!vm.wallsHidden)}
              >
                Стены
              </MobileActionButton>
              <MobileActionButton
                active={vm.spectaclePreviewMode}
                onClick={() => vm.setSpectaclePreviewMode(!vm.spectaclePreviewMode)}
              >
                Превью
              </MobileActionButton>
              <MobileActionButton
                active={vm.showControls}
                onClick={() => vm.setShowControls(!vm.showControls)}
              >
                Панели
              </MobileActionButton>
            </div>
          ) : null}
          {sheet === "objects" ? (
            <div className="theater-mobile-sheet__grid">
              <MobileActionButton
                active={vm.activeTab === "spotlights"}
                onClick={() => {
                  vm.setActiveTab("spotlights");
                  vm.setEditMode("spotlights");
                }}
              >
                Софиты · {vm.displaySpotlights.length}
              </MobileActionButton>
              <MobileActionButton
                active={vm.activeTab === "models"}
                onClick={() => {
                  vm.setActiveTab("models");
                  vm.setEditMode("models");
                }}
              >
                Модели · {vm.models.length}
              </MobileActionButton>
              <MobileActionButton
                active={vm.activeTab === "decor"}
                onClick={() => {
                  vm.setActiveTab("decor");
                  vm.setEditMode("decor");
                }}
              >
                Декор
              </MobileActionButton>
              <MobileActionButton
                active={vm.showSpotlights}
                onClick={() => vm.setShowSpotlights(!vm.showSpotlights)}
              >
                Свет в 3D
              </MobileActionButton>
            </div>
          ) : null}
          {sheet === "scene" ? (
            <>
              <div className="theater-mobile-sheet__grid">
                <MobileActionButton
                  active={vm.activeTab === "layout"}
                  onClick={() => vm.setActiveTab("layout")}
                >
                  План зала
                </MobileActionButton>
                <MobileActionButton
                  active={vm.lightConsoleExpanded}
                  onClick={() => vm.setLightConsoleExpanded((open) => !open)}
                >
                  Пульт света
                </MobileActionButton>
                <MobileActionButton
                  active={vm.dutyLightEnabled}
                  onClick={() => vm.setDutyLightEnabled(!vm.dutyLightEnabled)}
                >
                  Дежурка
                </MobileActionButton>
                <MobileActionButton
                  active={vm.smokeMachineEnabled}
                  onClick={() => {
                    if (!vm.smokeMachineEnabled) {
                      if (vm.spectaclePreviewMode) {
                        vm.setSpectaclePreviewMode(false);
                      }
                      vm.setSmokeMachineEnabled(true);
                      vm.setSmokePanelOpen(true);
                      return;
                    }
                    vm.setSmokePanelOpen(!vm.smokePanelOpen);
                  }}
                >
                  Дым
                </MobileActionButton>
                <MobileActionButton
                  active={vm.snapToGrid}
                  onClick={() => vm.setSnapToGrid(!vm.snapToGrid)}
                >
                  Привязка
                </MobileActionButton>
                <MobileActionButton
                  active={!isPanelsSwapped}
                  onClick={() => onTogglePanels?.()}
                  disabled={!onTogglePanels}
                >
                  Настройки
                </MobileActionButton>
              </div>
              {vm.activeTab === "layout" ? (
                <div className="theater-mobile-layout-settings">
                  <TheaterControlsLayoutTab vm={vm} />
                </div>
              ) : null}
            </>
          ) : null}
          {sheet === "save" ? (
            <div className="theater-mobile-sheet__stack">
              <p>
                Основные правки уже попадают в текущую сцену. Здесь можно сделать отдельный снимок
                3D-театра для телефона или экспорта.
              </p>
              <MobileActionButton onClick={saveLocalSnapshot}>
                Сохранить на устройстве
              </MobileActionButton>
              <MobileActionButton onClick={() => void copySnapshotJson()}>
                Копировать JSON
              </MobileActionButton>
              <MobileActionButton onClick={downloadSnapshotJson}>Экспорт JSON</MobileActionButton>
            </div>
          ) : null}
        </section>
      ) : null}
      <nav className="theater-mobile-actions__bar">
        <MobileActionButton active={sheet === "view"} onClick={() => openSheet("view")}>
          Вид
        </MobileActionButton>
        <MobileActionButton active={sheet === "objects"} onClick={() => openSheet("objects")}>
          Объекты
        </MobileActionButton>
        <MobileActionButton active={sheet === "scene"} onClick={() => openSheet("scene")}>
          Сцена
        </MobileActionButton>
        <MobileActionButton active={sheet === "save"} onClick={() => openSheet("save")}>
          Сохранить
        </MobileActionButton>
      </nav>
    </div>
  );
}

type MobileActionButtonProps = {
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
};

function MobileActionButton({
  active,
  disabled,
  children,
  onClick,
}: MobileActionButtonProps) {
  return (
    <button
      type="button"
      className={cn("theater-mobile-action-btn", active && "theater-mobile-action-btn--active")}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
