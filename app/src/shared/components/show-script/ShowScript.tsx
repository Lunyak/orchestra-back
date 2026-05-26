import React, { useMemo, useRef, useState } from 'react';
import { useProject } from "../../../features/project";
import { useScene } from "../../../features/scene";
import { useScriptUI } from '../../../features/script-ui';
import { useMyTroupeQuery } from "../../../features/troupe/api/troupe-api";
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
    addStep,
    resetAllRequisites,
    handleTrackLinkClick,
    handleSoundLinkClick,
    hasLocalEdits,
    realtimePullDeferred,
    realtimePullDeferredReason,
    clearRealtimePullDeferred,
    syncFromServer,
  } = useScene();

  const [newRequisite, setNewRequisite] = useState('');
  const requisitesClipboardRef = useRef<ScriptRequisite[] | null>(null);

  const {
    isEditing,
    setIsEditing,
  } = useScriptUI();

  const currentStep = steps[currentPage];
  const currentRequisites = currentStep?.requisites ?? [];
  const { data: troupeData } = useMyTroupeQuery(
    { project: projectSlug },
    { skip: !projectSlug },
  );
  const requisiteAssigneeOptions = useMemo(
    () =>
      (troupeData?.members ?? [])
        .map((member) => {
          const email = String(member.email ?? "").trim();
          const fullName = [member.profile?.firstName, member.profile?.lastName]
            .map((part) => String(part ?? "").trim())
            .filter(Boolean)
            .join(" ");
          const name = member.profile?.displayName?.trim() || fullName || email;
          if (!name) return null;
          return { value: name, label: name };
        })
        .filter((item): item is { value: string; label: string } => Boolean(item)),
    [troupeData?.members],
  );
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

  const updateRequisiteAssignees = (
    requisiteId: number,
    field: "setupAssignees" | "removeAssignees",
    assignees: string[],
  ) => {
    if (!currentStep) return;
    const nextRequisites = currentRequisites.map((item) =>
      item.id === requisiteId ? { ...item, [field]: assignees } : item
    );
    updateStepField(currentStep.id, 'requisites', nextRequisites);
  };

  const addRequisite = () => {
    if (!currentStep) return;
    const label = newRequisite.trim();
    if (!label) return;
    const nextId =
      currentRequisites.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const nextItem: ScriptRequisite = {
      id: nextId,
      label,
      checked: false,
      setupAssignees: [],
      removeAssignees: [],
    };
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
  const createStepFromSelection = (
    selectedText: string,
    targetField: "markdown" | "playMarkdown" | "explicationMarkdown",
  ) => {
    const nextStepId = steps.reduce((acc, step) => Math.max(acc, step.id), 0) + 1;
    addStep();
    updateSceneStep(nextStepId, { [targetField]: selectedText });
  };

  return (
    <div className="show-script">
      <div className="script-content">
        {realtimePullDeferred ? (
          <div className="realtime-banner" role="status" aria-live="polite">
            <div className="realtime-banner__text">
              {hasLocalEdits || realtimePullDeferredReason === "local_edits"
                ? "Есть обновления на сервере. Авто‑обновление отложено, пока есть локальные правки."
                : realtimePullDeferredReason === "settings_pause"
                  ? "Есть обновления на сервере. Авто‑подтягивание отключено в настройках (можно подтянуть вручную)."
                  : realtimePullDeferredReason === "confirm_declined"
                    ? "Есть обновления на сервере. Вы отказались от автоматического подтягивания."
                    : "Есть обновления из другого окна. Можно подтянуть сейчас."}
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
          onSoundLinkClick={handleSoundLinkClick}
          onCreateStepFromSelection={createStepFromSelection}
          requisitesPane={
            currentStep ? (
              <RequisitesPanel
                show
                isEditing={isEditing}
                requisites={currentRequisites}
                assigneeOptions={requisiteAssigneeOptions}
                hasCopiedRequisites={hasCopiedRequisites}
                newRequisite={newRequisite}
                setNewRequisite={setNewRequisite}
                onCopy={copyRequisites}
                onPaste={pasteRequisites}
                onResetAll={resetRequisites}
                onAdd={addRequisite}
                onToggle={toggleRequisite}
                onRemove={removeRequisite}
                onAssigneesChange={updateRequisiteAssignees}
              />
            ) : null
          }
          renderBody={({ markdownPane }) =>
            currentStep ? (
              <div className="script-step-editor">
                <div className="script-step-body">
                  <div className="script-step-main">
                    {markdownPane}
                  </div>
                </div>
              </div>
            ) : null
          }
        />
      </div>
    </div >
  );
};
