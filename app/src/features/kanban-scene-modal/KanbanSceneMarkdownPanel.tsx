import { useLayoutEffect, useRef } from "react";
import { useProject } from "../project";
import { usePlaybook } from "../playbook";
import "../../shared/components/show-script/style.css";
import { ShowScriptMarkdownSection } from "../../shared/components/show-script/components/ShowScriptMarkdownSection";
import type { ScriptScene } from "../../shared/types/script";

/**
 * Тяжёлый блок сценария: подключается через `React.lazy`, синхронизирует `currentPage` со сценой карточки.
 */
export default function KanbanSceneMarkdownPanel({ sceneId }: { sceneId: number }) {
  const { projectName } = useProject();
  const projectSlug = projectName || "fools";
  const sceneName = "script";
  const { scenes, currentPage, setCurrentPage, updateScene, handleTrackLinkClick, handleSoundLinkClick } =
    usePlaybook();

  const currentPageLive = useRef(currentPage);
  currentPageLive.current = currentPage;
  const savedPageRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const idx = scenes.findIndex((s) => s.id === sceneId);
    if (idx < 0) return;
    if (savedPageRef.current === null) {
      savedPageRef.current = currentPageLive.current;
    }
    setCurrentPage(idx);
    return () => {
      const p = savedPageRef.current;
      savedPageRef.current = null;
      if (p !== null) setCurrentPage(p);
    };
  }, [sceneId, scenes, setCurrentPage]);

  const updateSceneField = <K extends keyof ScriptScene>(id: number, field: K, value: ScriptScene[K]) => {
    updateScene(id, { [field]: value } as Partial<ScriptScene>);
  };

  return (
    <div className="kanban-scene-modal__markdown-root">
      <ShowScriptMarkdownSection
        projectSlug={projectSlug}
        sceneName={sceneName}
        updateSceneField={updateSceneField}
        onTrackLinkClick={handleTrackLinkClick}
        onSoundLinkClick={handleSoundLinkClick}
        lazyScriptBody
      />
    </div>
  );
}
