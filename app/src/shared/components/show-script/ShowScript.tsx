import React, { useRef, useState } from 'react';
import { useProject } from "../../../features/project";
import { useScene } from "../../../features/scene";
import { useScriptUI } from '../../../features/script-ui';
import { ScriptRequisite, ScriptStep } from "../../types/script";
import { RequisitesPanel } from "./components/RequisitesPanel";
import { ShowScriptMarkdownSection } from "./components/ShowScriptMarkdownSection";
import './style.css';


export const ShowScript: React.FC = () => {
  const { projectName } = useProject();
  const projectSlug = projectName || "fools";
  const sceneName = "script";

  const {
    steps,
    currentPage,
    updateStep: updateSceneStep,
    resetAllRequisites,
    handleTrackLinkClick,
  } = useScene();

  const [newRequisite, setNewRequisite] = useState('');
  const requisitesClipboardRef = useRef<ScriptRequisite[] | null>(null);

  const {
    showRequisites,
    isEditing,
    setIsEditing,
  } = useScriptUI();

  const currentStep = steps[currentPage];
  const currentRequisites = currentStep?.requisites ?? [];

  const updateStepField = <K extends keyof ScriptStep>(
    id: number,
    field: K,
    value: ScriptStep[K],
  ) => {
    updateSceneStep(id, { [field]: value } as Partial<ScriptStep>);
  };

  const toggleRequisite = (requisiteId: number) => {
    if (!currentStep) return;
    const nextRequisites = currentRequisites.map((item) =>
      item.id === requisiteId ? { ...item, checked: !item.checked } : item
    );
    updateStepField(currentStep.id, 'requisites', nextRequisites);
  };

  const removeRequisite = (requisiteId: number) => {
    if (!currentStep) return;
    const nextRequisites = currentRequisites.filter((item) => item.id !== requisiteId);
    updateStepField(currentStep.id, 'requisites', nextRequisites);
  };

  const addRequisite = () => {
    if (!currentStep) return;
    const label = newRequisite.trim();
    if (!label) return;
    const nextId =
      currentRequisites.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const nextItem: ScriptRequisite = { id: nextId, label, checked: false };
    updateStepField(currentStep.id, 'requisites', [...currentRequisites, nextItem]);
    setNewRequisite('');
  };

  const copyRequisites = () => {
    if (!currentStep) return;
    requisitesClipboardRef.current = currentRequisites.map((item) => ({ ...item }));
  };

  const resetRequisites = () => {
    resetAllRequisites();
  };

  const pasteRequisites = () => {
    if (!currentStep || !requisitesClipboardRef.current) return;
    const cloned = requisitesClipboardRef.current.map((item) => ({ ...item }));
    updateStepField(currentStep.id, 'requisites', cloned);
  };

  const hasCopiedRequisites = requisitesClipboardRef.current != null;

  return (
    <div className="show-script">
      <div className="script-content">
        <ShowScriptMarkdownSection
          projectSlug={projectSlug}
          sceneName={sceneName}
          updateStepField={updateStepField}
          onTrackLinkClick={handleTrackLinkClick}
          renderBody={({ markdownPane }) =>
            currentStep ? (
              <div className="script-step-editor">
                <div className="script-step-body">
                  {markdownPane}
                  <RequisitesPanel
                    show={showRequisites}
                    isEditing={isEditing}
                    requisites={currentRequisites}
                    hasCopiedRequisites={hasCopiedRequisites}
                    newRequisite={newRequisite}
                    setNewRequisite={setNewRequisite}
                    onCopy={copyRequisites}
                    onPaste={pasteRequisites}
                    onResetAll={resetRequisites}
                    onAdd={addRequisite}
                    onToggle={toggleRequisite}
                    onRemove={removeRequisite}
                  />
                </div>
              </div>
            ) : null
          }
        />
      </div>
    </div >
  );
};
