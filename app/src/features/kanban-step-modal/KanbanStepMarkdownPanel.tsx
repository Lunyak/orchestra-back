import { useLayoutEffect, useRef } from "react";
import { useProject } from "../project";
import { useScene } from "../scene";
import "../../shared/components/show-script/style.css";
import { ShowScriptMarkdownSection } from "../../shared/components/show-script/components/ShowScriptMarkdownSection";
import type { ScriptStep } from "../../shared/types/script";

/**
 * Тяжёлый блок сценария: подключается через `React.lazy`, синхронизирует `currentPage` с шагом карточки.
 */
export default function KanbanStepMarkdownPanel({ stepId }: { stepId: number }) {
  const { projectName } = useProject();
  const projectSlug = projectName || "fools";
  const sceneName = "script";
  const { steps, currentPage, setCurrentPage, updateStep, handleTrackLinkClick, handleSoundLinkClick } =
    useScene();

  const currentPageLive = useRef(currentPage);
  currentPageLive.current = currentPage;
  const savedPageRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const idx = steps.findIndex((s) => s.id === stepId);
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
  }, [stepId, steps, setCurrentPage]);

  const updateStepField = <K extends keyof ScriptStep>(id: number, field: K, value: ScriptStep[K]) => {
    updateStep(id, { [field]: value } as Partial<ScriptStep>);
  };

  return (
    <div className="kanban-step-modal__markdown-root">
      <ShowScriptMarkdownSection
        projectSlug={projectSlug}
        sceneName={sceneName}
        updateStepField={updateStepField}
        onTrackLinkClick={handleTrackLinkClick}
        onSoundLinkClick={handleSoundLinkClick}
        lazyScriptBody
      />
    </div>
  );
}
