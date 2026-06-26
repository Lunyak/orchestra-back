import cn from "classnames";
import { usePlaybook } from "../../../playbook/model/playbook-context";
import type { TheaterControlsTabProps } from "./types";

export function TheaterControlsProjectSection({ vm }: TheaterControlsTabProps) {
  const { scenes, currentPage, setCurrentPage } = usePlaybook();

  return (
    <div className="theater-editor-project">
      <div className="theater-editor-panel-block">
        <div className="theater-editor-panel-row">
          <span className="theater-editor-panel-label">Проект</span>
          <span className="theater-editor-panel-value" title={vm.projectName}>
            {vm.projectName}
          </span>
        </div>
        <div className="theater-editor-panel-row">
          <span className="theater-editor-panel-label">Сцена</span>
          <span className="theater-editor-panel-value">
            {vm.currentScene
              ? `${currentPage + 1} / ${vm.sceneCount}`
              : `— / ${vm.sceneCount}`}
          </span>
        </div>
        {vm.currentScene?.title ? (
          <div className="theater-editor-panel-row theater-editor-panel-row--stack">
            <span className="theater-editor-panel-label">Название</span>
            <span className="theater-editor-panel-value">{vm.currentScene.title}</span>
          </div>
        ) : null}
      </div>

      <div className="theater-editor-panel-heading">Сцены сценария</div>
      <div className="theater-editor-project-scenes" role="listbox" aria-label="Сцены сценария">
        {scenes.length === 0 ? (
          <p className="theater-editor-outliner-empty">Нет сцен</p>
        ) : (
          scenes.map((scene, index) => {
            const active = index === currentPage;
            const label = scene.title?.trim() || `Сцена ${index + 1}`;
            const meta =
              scene.durationMin != null && Number.isFinite(scene.durationMin)
                ? `${scene.durationMin} мин`
                : undefined;
            return (
              <button
                key={scene.id}
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  "theater-editor-outliner-option",
                  "theater-editor-outliner-option--scene",
                  active && "theater-editor-outliner-option--active",
                )}
                title={label}
                onClick={() => setCurrentPage(index)}
              >
                <span className="theater-editor-outliner-spacer" aria-hidden />
                <span className="theater-editor-outliner-type Script" aria-hidden />
                <span className="theater-editor-outliner-name">{label}</span>
                {meta ? (
                  <span className="theater-editor-outliner-meta">{meta}</span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
