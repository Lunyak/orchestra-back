import React, { useRef, useState } from 'react';
import { useProject } from "../../../features/project";
import { useScene } from "../../../features/scene";
import { useScriptUI } from '../../../features/script-ui';
import { selectShowScriptMarkdownUi, showScriptMarkdownActions } from '../../../features/show-script-markdown/model/show-script-markdown-slice';
import { Button } from '../../core/button/Button';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { ScriptRequisite, ScriptStep } from "../../types/script";
import { RequisitesPanel } from "./components/RequisitesPanel";
import { ShowScriptMarkdownSection } from "./components/ShowScriptMarkdownSection";
import { StepRolesPanel } from "./components/StepRolesPanel";
import ControlsScript from "./controls-script/ControlsScript";
import './style.css';


export const ShowScript: React.FC = () => {
  const { projectName } = useProject();
  const projectSlug = projectName || "fools";
  const sceneName = "script";
  const dispatch = useAppDispatch();

  const {
    steps,
    currentPage,
    updateStep: updateSceneStep,
    resetAllRequisites,
    handleTrackLinkClick,
    hasLocalEdits,
    realtimePullDeferred,
    clearRealtimePullDeferred,
    syncFromServer,
  } = useScene();

  const [newRequisite, setNewRequisite] = useState('');
  const requisitesClipboardRef = useRef<ScriptRequisite[] | null>(null);

  const {
    showRequisites,
    showStepRoles,
    showScriptEditorTools,
    isEditing,
    setIsEditing,
  } = useScriptUI();

  const currentStep = steps[currentPage];
  const currentRequisites = currentStep?.requisites ?? [];
  const markdownUi = useAppSelector((s) => selectShowScriptMarkdownUi(s, projectSlug, sceneName));
  const annotationsMode = markdownUi.annotationsMode;

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
        {realtimePullDeferred ? (
          <div className="realtime-banner" role="status" aria-live="polite">
            <div className="realtime-banner__text">
              Есть обновления из другого окна.
              {hasLocalEdits
                ? " Авто‑обновление отложено, пока есть локальные правки."
                : " Можно подтянуть сейчас."}
            </div>
            <div className="realtime-banner__actions">
              <button
                className="realtime-banner__btn"
                onClick={() => syncFromServer(null, projectSlug)}
                disabled={hasLocalEdits}
                title={hasLocalEdits ? "Сначала дождитесь сохранения локальных правок" : "Подтянуть обновления"}
              >
                Подтянуть
              </button>
              <button className="realtime-banner__btn realtime-banner__btn--secondary" onClick={clearRealtimePullDeferred}>
                Скрыть
              </button>
            </div>
          </div>
        ) : null}

        <ShowScriptMarkdownSection
          projectSlug={projectSlug}
          sceneName={sceneName}
          updateStepField={updateStepField}
          onTrackLinkClick={handleTrackLinkClick}
          renderBody={({ markdownPane, controls }) =>
            currentStep ? (
              <div className="script-step-editor">
                <div className="script-step-body">
                  <div className="script-step-main">
                    {markdownPane}
                  </div>
                  {(showStepRoles || (showScriptEditorTools && isEditing && controls)) ? (
                    <div className="script-step-asides">
                      {showStepRoles ? <StepRolesPanel step={currentStep} /> : null}
                      {showScriptEditorTools && isEditing && controls ? (
                        <ControlsScript
                          selectedTrackId={controls.selectedTrackId}
                          playlistOptions={controls.playlistOptions}
                          onSelectedTrackIdChange={controls.onSelectedTrackIdChange}
                          lightChannels={controls.lightChannels}
                          onLightChannelsChange={controls.onLightChannelsChange}
                          selectedLightSlot={controls.selectedLightSlot}
                          onSelectedLightSlotChange={controls.onSelectedLightSlotChange}
                          onInsertText={controls.onInsertText}
                        />
                      ) : null}
                    </div>
                  ) : null}
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
