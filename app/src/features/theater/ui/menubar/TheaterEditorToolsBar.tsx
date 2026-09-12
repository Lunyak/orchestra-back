import cn from "classnames";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";

export type TheaterEditorToolsBarProps = {
  vm: TheaterSceneViewModel;
  immersiveMode?: boolean;
  onImmersiveModeChange?: (value: boolean) => void;
};

export function TheaterEditorToolsBar({
  vm,
  immersiveMode = false,
  onImmersiveModeChange,
}: TheaterEditorToolsBarProps) {
  const isExpanded = vm.lightConsoleExpanded;
  const dutyLightEnabled = vm.dutyLightEnabled;
  const smokeMachineEnabled = vm.smokeMachineEnabled;
  const smokePanelOpen = vm.smokePanelOpen;

  return (
    <div className="theater-scene-tools-bar" aria-label="Инструменты 3D театра">
      <button
        type="button"
        className={cn(
          "theater-scene-tools-bar__btn",
          isExpanded && "theater-scene-tools-bar__btn--active",
        )}
        aria-pressed={isExpanded}
        onClick={() => {
          const nextExpanded = !isExpanded;
          vm.setLightConsoleExpanded(nextExpanded);
          if (nextExpanded) vm.setEditMode("spotlights");
        }}
      >
        Пульт света
      </button>
      <button
        type="button"
        className={cn(
          "theater-scene-tools-bar__btn",
          dutyLightEnabled && "theater-scene-tools-bar__btn--active",
        )}
        aria-pressed={dutyLightEnabled}
        title={
          dutyLightEnabled
            ? "Выключить рабочий свет: останутся только софиты"
            : "Включить рабочий свет сцены"
        }
        onClick={() => vm.setDutyLightEnabled(!dutyLightEnabled)}
      >
        Дежурка
      </button>
      <button
        type="button"
        className={cn(
          "theater-scene-tools-bar__btn",
          smokeMachineEnabled && "theater-scene-tools-bar__btn--active",
        )}
        aria-pressed={smokeMachineEnabled}
        title={
          smokeMachineEnabled
            ? smokePanelOpen
              ? "Скрыть настройки дыма (дым останется)"
              : "Показать настройки дыма"
            : "Включить дым-машину: haze и видимые лучи"
        }
        onClick={() => {
          if (!smokeMachineEnabled) {
            if (vm.spectaclePreviewMode) vm.setSpectaclePreviewMode(false);
            vm.setSmokeMachineEnabled(true);
            vm.setSmokePanelOpen(true);
            return;
          }
          vm.setSmokePanelOpen(!smokePanelOpen);
        }}
      >
        Дым
      </button>
      {onImmersiveModeChange ? (
        <button
          type="button"
          className={cn(
            "theater-scene-tools-bar__btn",
            "theater-scene-tools-bar__btn--immersive",
            immersiveMode && "theater-scene-tools-bar__btn--active",
          )}
          aria-pressed={immersiveMode}
          title={
            immersiveMode
              ? "Вернуть обычный вид (Esc)"
              : "3D-театр на весь экран"
          }
          onClick={() => {
            const next = !immersiveMode;
            onImmersiveModeChange(next);
            const root = document.querySelector(".theater-scheme-tabs-shell");
            if (next) {
              void root?.requestFullscreen?.().catch(() => undefined);
              return;
            }
            if (document.fullscreenElement) {
              void document.exitFullscreen?.().catch(() => undefined);
            }
          }}
        >
          {immersiveMode ? "Выйти" : "Весь экран"}
        </button>
      ) : null}
    </div>
  );
}
