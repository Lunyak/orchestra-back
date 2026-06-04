import cn from "classnames";
import { useMemo, useState } from "react";
import { DialogueSceneTrainer } from "../../actor-trainers/ui/DialogueSceneTrainer";
import { VoiceDialogueTrainer } from "../../actor-trainers/ui/VoiceDialogueTrainer";
import { PhraseWriteTrainer } from "../../actor-trainers/ui/PhraseWriteTrainer";
import { Button } from "../../../shared/core/button/Button";
import { CustomSelect } from "../../../shared/core/custom-select/CustomSelect";
import { useAppEditorMenubarActionsRender, useAppEditorViewMenuRender } from "../../../shared/components/app-editor-menubar/AppEditorMenubarContext";
import { AppEditorActorTrainerMenu } from "../../../shared/components/app-editor-menubar/AppEditorActorTrainerMenu";
import { Modal } from "../../../shared/core/modal/Modal";
import { useActorPage } from "../model/useActorPage";
import "./style.css";

export function ActorPageView() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stepPickerOpen, setStepPickerOpen] = useState(false);
  const [expandedStepIds, setExpandedStepIds] = useState<Set<number>>(() => new Set());
  const {
    projects,
    projectName,
    onProjectChange,
    steps,
    profileLoading,
    myEmail,
    canPickAnyRole,
    rolesLoading,
    rolesForActor,
    rolesError,
    setRoleId,
    effectiveRoleInfo,
    effectiveRoleTitle,
    effectiveRoleKeys,
    phraseSteps,
    phraseStepsEmptyHint,
    phrasesByStep,
    normalizedSelectedStepIds,
    setSelectedStepIds,
    totalInAllSteps,
    filteredPhrases,
    trainerMode,
    setTrainerMode,
    selectedStepIdsForTraining,
    trainerStorageKey,
    dialogueStorageKey,
    voiceStorageKey,
    projectItems,
  } = useActorPage();

  const projectSelectOptions = useMemo(
    () =>
      projectItems.map((project) => ({
        value: project.slug,
        label: project.name || project.slug,
      })),
    [projectItems],
  );

  const roleSelectOptions = useMemo(
    () =>
      rolesForActor.map((r) => ({
        value: String(r.id),
        label: String(r.title ?? r.key ?? r.id),
      })),
    [rolesForActor],
  );

  const roleSelectPlaceholder = rolesLoading
    ? "Загрузка ролей…"
    : myEmail
      ? "Нет ролей для вашего пользователя"
      : "Профиль не загружен";

  const stepPickerDisabled = !effectiveRoleInfo || phraseSteps.length === 0;
  const selectedStepsText = normalizedSelectedStepIds === "all" ? "все" : String(normalizedSelectedStepIds.length);
  const selectedScenesButtonText =
    normalizedSelectedStepIds === "all"
      ? `Выбрать сцены: все (${phraseSteps.length})`
      : `Выбрать сцены: ${normalizedSelectedStepIds.length} из ${phraseSteps.length}`;

  const toggleStepSelection = (stepId: number, nextChecked: boolean) => {
    setSelectedStepIds((prev) => {
      if (prev === "all") {
        if (nextChecked) return "all";
        return phraseSteps.map((x) => x.stepId).filter((id) => id !== stepId);
      }
      const set = new Set(prev);
      if (nextChecked) set.add(stepId);
      else set.delete(stepId);
      return Array.from(set.values()).sort((a, b) => a - b);
    });
  };

  const toggleStepExpanded = (stepId: number) => {
    setExpandedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  useAppEditorViewMenuRender(
    "actor-trainer-menu",
    10,
    () => (
      <AppEditorActorTrainerMenu trainerMode={trainerMode} onSetTrainerMode={setTrainerMode} />
    ),
  );

  useAppEditorMenubarActionsRender("actor-settings", 20, () => (
    <button
      type="button"
      className={cn("app-editor-menubar__panel-btn", settingsOpen && "app-editor-menubar__panel-btn--active")}
      onClick={() => setSettingsOpen((open) => !open)}
      title="Настройки актёрского тренажёра"
      aria-label="Настройки актёрского тренажёра"
      aria-pressed={settingsOpen}
    >
      ⚙
    </button>
  ));

  return (
    <div className="app-layout actor-layout">
      <div className="app-content">
        <main className="main-content actor-main">
          <div className="actor-view">
            <Modal
              isOpen={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              panelClassName="actor-settings-modal"
              ariaLabel="Настройки актёра"
            >
              <div className="actor-settings-modal__head">
                <div>
                  <div className="actor-label">Настройки</div>
                  <div className="actor-settings-modal__title">Актёрский тренажёр</div>
                </div>
              </div>
              <div className="actor-controls actor-controls--modal">
                <label className="actor-field">
                  <div className="actor-label">Проект</div>
                  <CustomSelect
                    value={projects.length > 0 ? projectName : ""}
                    options={projectSelectOptions}
                    onChange={onProjectChange}
                    placeholder="Выберите проект"
                    noOptionsLabel="Проектов нет"
                    disabled={projects.length === 0}
                    triggerClassName="actor-select"
                    dropdownClassName="actor-select-dropdown"
                    aria-label="Проект"
                  />
                </label>

                <label className="actor-field">
                  <div className="actor-label">Роль</div>
                  <CustomSelect
                    value={effectiveRoleInfo?.id != null ? String(effectiveRoleInfo.id) : ""}
                    options={roleSelectOptions}
                    onChange={setRoleId}
                    placeholder={roleSelectPlaceholder}
                    noOptionsLabel={roleSelectPlaceholder}
                    disabled={!myEmail || rolesLoading || rolesForActor.length === 0}
                    triggerClassName="actor-select"
                    dropdownClassName="actor-select-dropdown"
                    aria-label="Роль"
                  />
                  {profileLoading ? <div className="actor-hint">Загрузка профиля…</div> : null}
                  {!canPickAnyRole && myEmail && rolesForActor.length === 0 && !rolesLoading ? (
                    <div className="actor-hint">
                      Похоже, роли не назначены на ваш email. Назначьте себя на роль в карточке сцены на доске{" "}
                      <b>готовности</b>.
                    </div>
                  ) : null}
                  {rolesError ? (
                    <div className="actor-hint">Ошибка загрузки ролей: {rolesError}</div>
                  ) : null}
                </label>

                <div className="actor-field">
                  <div className="actor-label">Сцены (шаги) для тренировки</div>
                  <div className="actor-step-picker">
                    <div className="actor-step-picker-actions">
                      <Button
                        className="actor-step-btn secondary"
                        type="button"
                        onClick={() => setStepPickerOpen(true)}
                        disabled={!effectiveRoleInfo}
                      >
                        {selectedScenesButtonText}
                      </Button>
                    </div>
                    {phraseSteps.length === 0 ? (
                      <div className="actor-hint">
                        {phraseStepsEmptyHint ?? "Нет шагов с репликами выбранной роли."}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </Modal>

            <Modal
              isOpen={stepPickerOpen}
              onClose={() => {
                setStepPickerOpen(false);
              }}
              panelClassName="actor-step-picker-modal"
              ariaLabel="Выбор сцен для тренировки"
            >
              <div className="actor-step-picker-modal__head">
                <div>
                  <div className="actor-label">Сцены (шаги) для тренировки</div>
                  <div className="actor-step-picker-meta">
                    Выбрано: <b>{selectedStepsText}</b>
                  </div>
                </div>
                <Button
                  className="actor-step-btn secondary"
                  type="button"
                  onClick={() => {
                    setStepPickerOpen(false);
                  }}
                >
                  Закрыть
                </Button>
              </div>

              <div className="actor-step-picker-modal__toolbar">
                <Button
                  className="actor-step-btn secondary"
                  type="button"
                  onClick={() => setSelectedStepIds("all")}
                  disabled={stepPickerDisabled}
                >
                  Все ({totalInAllSteps})
                </Button>
                <Button
                  className="actor-step-btn secondary"
                  type="button"
                  onClick={() => setSelectedStepIds([])}
                  disabled={stepPickerDisabled}
                >
                  Очистить
                </Button>
              </div>

              <div className="actor-step-picker-list actor-step-picker-modal__list" aria-label="Список шагов">
                {phraseSteps.length === 0 ? (
                  <div className="actor-hint">
                    {phraseStepsEmptyHint ?? "Нет шагов с репликами выбранной роли."}
                  </div>
                ) : (
                  phraseSteps.map((s) => {
                    const checked =
                      normalizedSelectedStepIds === "all" ? true : normalizedSelectedStepIds.includes(s.stepId);
                    const examples = (phrasesByStep.get(s.stepId) ?? []).slice(0, 2);
                    const stepSource = steps.find((step) => Number(step.id) === s.stepId) ?? null;
                    const stepText = String(stepSource?.playMarkdown || stepSource?.markdown || "").trim();
                    const expanded = expandedStepIds.has(s.stepId);

                    return (
                      <div
                        key={s.stepId}
                        className={cn("actor-step-item", checked && "actor-step-item--selected")}
                        role="checkbox"
                        aria-checked={checked}
                        tabIndex={0}
                        onClick={() => toggleStepSelection(s.stepId, !checked)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          toggleStepSelection(s.stepId, !checked);
                        }}
                      >
                        <input
                          className="actor-step-hidden-checkbox"
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleStepSelection(s.stepId, e.target.checked)}
                          tabIndex={-1}
                        />
                        <span className="actor-step-id actor-step-id--corner">#{s.stepId}</span>
                        <span className="actor-step-main">
                          <span className="actor-step-title">{s.stepTitle}</span>
                          {examples.length > 0 ? (
                            <span className="actor-step-examples">
                              {examples.map((ex, idx) => (
                                <span key={`${s.stepId}-ex-${idx}`} className="actor-step-example">
                                  “{String(ex.text).slice(0, 90)}
                                  {ex.text.length > 90 ? "…" : ""}”
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </span>
                        {stepText ? (
                          <button
                            className="actor-step-disclosure"
                            type="button"
                            aria-expanded={expanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStepExpanded(s.stepId);
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            {expanded ? "Скрыть текст сцены" : "Показать текст сцены"}
                          </button>
                        ) : null}
                        {expanded && stepText ? (
                          <div className="actor-step-full-text" onClick={(e) => e.stopPropagation()}>
                            {stepText}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </Modal>

            <div className="actor-section">
              {trainerMode === "dialogue" ? (
                <DialogueSceneTrainer
                  steps={steps}
                  role={effectiveRoleTitle}
                  roleKeys={effectiveRoleKeys}
                  selectedStepIds={selectedStepIdsForTraining}
                  storageKey={dialogueStorageKey || undefined}
                />
              ) : trainerMode === "voice" ? (
                <VoiceDialogueTrainer
                  steps={steps}
                  role={effectiveRoleTitle}
                  roleKeys={effectiveRoleKeys}
                  selectedStepIds={selectedStepIdsForTraining}
                  storageKey={voiceStorageKey || undefined}
                  performerId={myEmail}
                  performerLabel={myEmail || undefined}
                />
              ) : (
                <PhraseWriteTrainer
                  steps={steps}
                  role={effectiveRoleTitle}
                  roleKeys={effectiveRoleKeys}
                  selectedStepIds={selectedStepIdsForTraining}
                  storageKey={trainerStorageKey || undefined}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
