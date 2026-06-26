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
  const [scenePickerOpen, setScenePickerOpen] = useState(false);
  const [expandedSceneIds, setExpandedSceneIds] = useState<Set<number>>(() => new Set());
  const {
    projects,
    projectName,
    onProjectChange,
    scenes,
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
    phraseScenes,
    phraseScenesEmptyHint,
    phrasesByScene,
    normalizedSelectedSceneIds,
    setSelectedSceneIds,
    totalInAllScenes,
    filteredPhrases,
    trainerMode,
    setTrainerMode,
    selectedPlaybookIdsForTraining,
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

  const scenePickerDisabled = !effectiveRoleInfo || phraseScenes.length === 0;
  const selectedScenesText = normalizedSelectedSceneIds === "all" ? "все" : String(normalizedSelectedSceneIds.length);
  const selectedScenesButtonText =
    normalizedSelectedSceneIds === "all"
      ? `Выбрать сцены: все (${phraseScenes.length})`
      : `Выбрать сцены: ${normalizedSelectedSceneIds.length} из ${phraseScenes.length}`;

  const toggleSceneSelection = (sceneId: number, nextChecked: boolean) => {
    setSelectedSceneIds((prev) => {
      if (prev === "all") {
        if (nextChecked) return "all";
        return phraseScenes.map((x) => x.sceneId).filter((id) => id !== sceneId);
      }
      const set = new Set(prev);
      if (nextChecked) set.add(sceneId);
      else set.delete(sceneId);
      return Array.from(set.values()).sort((a, b) => a - b);
    });
  };

  const toggleSceneExpanded = (sceneId: number) => {
    setExpandedSceneIds((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
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
              <div className="actor-settings-modal__header">
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
                  <div className="actor-label">Сцены для тренировки</div>
                  <div className="actor-scene-picker">
                    <div className="actor-scene-picker-actions">
                      <Button
                        className="actor-scene-btn secondary"
                        type="button"
                        onClick={() => setScenePickerOpen(true)}
                        disabled={!effectiveRoleInfo}
                      >
                        {selectedScenesButtonText}
                      </Button>
                    </div>
                    {phraseScenes.length === 0 ? (
                      <div className="actor-hint">
                        {phraseScenesEmptyHint ?? "Нет сцен с репликами выбранной роли."}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </Modal>

            <Modal
              isOpen={scenePickerOpen}
              onClose={() => {
                setScenePickerOpen(false);
              }}
              panelClassName="actor-scene-picker-modal"
              ariaLabel="Выбор сцен для тренировки"
            >
              <div className="actor-scene-picker-modal__header">
                <div>
                  <div className="actor-label">Сцены для тренировки</div>
                  <div className="actor-scene-picker-meta">
                    Выбрано: <b>{selectedScenesText}</b>
                  </div>
                </div>
                <Button
                  className="actor-scene-btn secondary"
                  type="button"
                  onClick={() => {
                    setScenePickerOpen(false);
                  }}
                >
                  Закрыть
                </Button>
              </div>

              <div className="actor-scene-picker-modal__toolbar">
                <Button
                  className="actor-scene-btn secondary"
                  type="button"
                  onClick={() => setSelectedSceneIds("all")}
                  disabled={scenePickerDisabled}
                >
                  Все ({totalInAllScenes})
                </Button>
                <Button
                  className="actor-scene-btn secondary"
                  type="button"
                  onClick={() => setSelectedSceneIds([])}
                  disabled={scenePickerDisabled}
                >
                  Очистить
                </Button>
              </div>

              <div className="actor-scene-picker-list actor-scene-picker-modal__list" aria-label="Список сцен">
                {phraseScenes.length === 0 ? (
                  <div className="actor-hint">
                    {phraseScenesEmptyHint ?? "Нет сцен с репликами выбранной роли."}
                  </div>
                ) : (
                  phraseScenes.map((s) => {
                    const checked =
                      normalizedSelectedSceneIds === "all" ? true : normalizedSelectedSceneIds.includes(s.sceneId);
                    const examples = (phrasesByScene.get(s.sceneId) ?? []).slice(0, 2);
                    const sceneSource = scenes.find((scene) => Number(scene.id) === s.sceneId) ?? null;
                    const sceneText = String(sceneSource?.playMarkdown || sceneSource?.markdown || "").trim();
                    const expanded = expandedSceneIds.has(s.sceneId);

                    return (
                      <div
                        key={s.sceneId}
                        className={cn("actor-scene-item", checked && "actor-scene-item--selected")}
                        role="checkbox"
                        aria-checked={checked}
                        tabIndex={0}
                        onClick={() => toggleSceneSelection(s.sceneId, !checked)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          toggleSceneSelection(s.sceneId, !checked);
                        }}
                      >
                        <input
                          className="actor-scene-hidden-checkbox"
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleSceneSelection(s.sceneId, e.target.checked)}
                          tabIndex={-1}
                        />
                        <span className="actor-scene-id actor-scene-id--corner">#{s.sceneId}</span>
                        <span className="actor-scene-main">
                          <span className="actor-scene-title">{s.sceneTitle}</span>
                          {examples.length > 0 ? (
                            <span className="actor-scene-examples">
                              {examples.map((ex, idx) => (
                                <span key={`${s.sceneId}-ex-${idx}`} className="actor-scene-example">
                                  “{String(ex.text).slice(0, 90)}
                                  {ex.text.length > 90 ? "…" : ""}”
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </span>
                        {sceneText ? (
                          <button
                            className="actor-scene-disclosure"
                            type="button"
                            aria-expanded={expanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSceneExpanded(s.sceneId);
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            {expanded ? "Скрыть текст сцены" : "Показать текст сцены"}
                          </button>
                        ) : null}
                        {expanded && sceneText ? (
                          <div className="actor-scene-full-text" onClick={(e) => e.stopPropagation()}>
                            {sceneText}
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
                  scenes={scenes}
                  role={effectiveRoleTitle}
                  roleKeys={effectiveRoleKeys}
                  selectedPlaybookIds={selectedPlaybookIdsForTraining}
                  storageKey={dialogueStorageKey || undefined}
                />
              ) : trainerMode === "voice" ? (
                <VoiceDialogueTrainer
                  scenes={scenes}
                  role={effectiveRoleTitle}
                  roleKeys={effectiveRoleKeys}
                  selectedPlaybookIds={selectedPlaybookIdsForTraining}
                  storageKey={voiceStorageKey || undefined}
                  performerId={myEmail}
                  performerLabel={myEmail || undefined}
                />
              ) : (
                <PhraseWriteTrainer
                  scenes={scenes}
                  role={effectiveRoleTitle}
                  roleKeys={effectiveRoleKeys}
                  selectedPlaybookIds={selectedPlaybookIdsForTraining}
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
