import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import { TheaterEditorViewMenu } from "./menubar/TheaterEditorViewMenu";

export type TheaterEditorMenubarProps = {
  vm: TheaterSceneViewModel;
};

/**
 * Верхняя полоса в духе https://threejs.org/editor/ (#menubar).
 */
export function TheaterEditorMenubar({ vm }: TheaterEditorMenubarProps) {
  return (
    <header className="theater-editor-menubar" aria-label="Меню редактора театра">
      <div className="theater-editor-menubar__track">
        <div className="theater-editor-menubar__menus">
          <TheaterEditorViewMenu vm={vm} />
        </div>
      </div>
    </header>
  );
}
