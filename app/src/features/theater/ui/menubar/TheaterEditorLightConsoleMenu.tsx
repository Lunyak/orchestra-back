import cn from "classnames";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";

export type TheaterEditorLightConsoleMenuProps = {
  vm: TheaterSceneViewModel;
};

/** Пункт меню-кнопка: пульт — состояние, не вкладка настроек. */
export function TheaterEditorLightConsoleMenu({
  vm,
}: TheaterEditorLightConsoleMenuProps) {
  const isExpanded = vm.lightConsoleExpanded;

  return (
    <button
      type="button"
      className={cn(
        "app-editor-menubar__home",
        isExpanded && "app-editor-menubar__home--active",
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
  );
}
