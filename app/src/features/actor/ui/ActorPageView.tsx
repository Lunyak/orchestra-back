import cn from "classnames";
import { useMemo } from "react";
import { DialogueSceneTrainer } from "../../actor-trainers/ui/DialogueSceneTrainer";
import { VoiceDialogueTrainer } from "../../actor-trainers/ui/VoiceDialogueTrainer";
import { PhraseWriteTrainer } from "../../actor-trainers/ui/PhraseWriteTrainer";
import { Button } from "../../../shared/core/button/Button";
import { CustomSelect } from "../../../shared/core/custom-select/CustomSelect";
import { LabeledCheckbox } from "../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { useActorPage } from "../model/useActorPage";
import "./style.css";

export function ActorPageView() {
  const {
    projects,
    projectName,
    onProjectChange,
    steps,
    settingsHidden,
    setSettingsHidden,
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
    scenesLabel,
    trainerStorageKey,
    dialogueStorageKey,
    voiceStorageKey,
    openStepInScript,
    projectItems,
    currentProjectDisplayName,
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

  return (
    <div className="app-layout actor-layout">
      <div className="app-content">
        <main className="main-content actor-main">
          <div className="actor-view">
            <h2>Актёр</h2>
            <p className="actor-subtitle">
              Тренажёры для заучивания текста роли.
            </p>

            <div className="actor-topbar">
              <div className="actor-topbar-actions">
                <Button
                  className={cn("actor-topbar-btn", !settingsHidden ? "is-active" : "secondary")}
                  type="button"
                  onClick={() => setSettingsHidden((v) => !v)}
                >
                  {settingsHidden ? "Показать настройки" : "Скрыть настройки"}
                </Button>
              </div>
              <div className="actor-topbar-meta">
                Проект: <b>{currentProjectDisplayName || "—"}</b> · Роль: <b>{effectiveRoleTitle || "—"}</b> · Сцены:{" "}
                <b>{scenesLabel}</b>
              </div>
            </div>

            {!settingsHidden ? (
              <div className="actor-controls">
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
                    aria-label="Проект"
                  />
                </label>

                <label className="actor-field">
                  <div className="actor-label">Пользователь</div>
                  <div className="actor-static">
                    {profileLoading ? "загрузка профиля…" : myEmail || "—"}
                  </div>
                  <div className="actor-hint">
                    {canPickAnyRole
                      ? "Вы можете выбирать любые роли (режиссёр/автор проекта)."
                      : "Роли показываются только для текущего пользователя."}
                  </div>
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
                    aria-label="Роль"
                  />
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

                <label className="actor-field">
                  <div className="actor-label">Сцены (шаги) для тренировки</div>
                  <div className="actor-step-picker">
                    <div className="actor-step-picker-actions">
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
                      <div className="actor-step-picker-meta">
                        Выбрано:{" "}
                        <b>
                          {normalizedSelectedStepIds === "all"
                            ? "все"
                            : normalizedSelectedStepIds.length}
                        </b>
                      </div>
                    </div>

                    <div className="actor-step-picker-list" aria-label="Список шагов">
                      {phraseSteps.length === 0 ? (
                        <div className="actor-hint">
                          {phraseStepsEmptyHint ?? "Нет шагов с репликами выбранной роли."}
                        </div>
                      ) : (
                        phraseSteps.map((s) => {
                          const checked =
                            normalizedSelectedStepIds === "all"
                              ? true
                              : normalizedSelectedStepIds.includes(s.stepId);
                          const examples = (phrasesByStep.get(s.stepId) ?? []).slice(0, 2);
                          return (
                            <div key={s.stepId} className="actor-step-item">
                              <LabeledCheckbox
                                className="actor-step-item-check"
                                id={`actor-step-${s.stepId}`}
                                checked={checked}
                                onChange={(nextChecked) => toggleStepSelection(s.stepId, nextChecked)}
                              >
                                <span className="actor-step-main">
                                  <span className="actor-step-title">
                                    {s.stepTitle}{" "}
                                    <span className="actor-step-id">#{s.stepId}</span>
                                  </span>
                                  {examples.length > 0 ? (
                                    <span className="actor-step-examples">
                                      {examples.map((ex, idx) => (
                                        <span
                                          key={`${s.stepId}-ex-${idx}`}
                                          className="actor-step-example"
                                        >
                                          “{String(ex.text).slice(0, 90)}
                                          {ex.text.length > 90 ? "…" : ""}”
                                        </span>
                                      ))}
                                    </span>
                                  ) : null}
                                </span>
                              </LabeledCheckbox>
                              <span
                                className="actor-step-count"
                                title="Количество реплик вашей роли в этом шаге"
                              >
                                {s.count}
                              </span>
                              <Button
                                className="actor-step-open secondary"
                                type="button"
                                onClick={() => openStepInScript(s.stepId)}
                                title="Открыть этот шаг в сценарии"
                              >
                                Открыть
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </label>
              </div>
            ) : null}

            <div className="actor-section">
              <div className="actor-section-head">
                <div className="actor-section-title">Тренажёр 1</div>
                <div className="actor-section-meta">
                  Реплик найдено: <b>{filteredPhrases.length}</b>
                </div>
              </div>

              <div className="actor-mode-tabs" role="tablist" aria-label="Режим тренировки">
                <Button
                  className={cn("actor-mode-tab", trainerMode === "dialogue" ? "is-active" : "secondary")}
                  type="button"
                  onClick={() => setTrainerMode("dialogue")}
                >
                  Диалог
                </Button>
                <Button
                  className={cn("actor-mode-tab", trainerMode === "write" ? "is-active" : "secondary")}
                  type="button"
                  onClick={() => setTrainerMode("write")}
                >
                  Напиши фразу
                </Button>
                <Button
                  className={cn("actor-mode-tab", trainerMode === "voice" ? "is-active" : "secondary")}
                  type="button"
                  onClick={() => setTrainerMode("voice")}
                >
                  Голос
                </Button>
              </div>

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
