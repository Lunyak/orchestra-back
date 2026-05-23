import { DialogueSceneTrainer } from "../../actor-trainers/ui/DialogueSceneTrainer";
import { VoiceDialogueTrainer } from "../../actor-trainers/ui/VoiceDialogueTrainer";
import { WordOrderTrainer } from "../../actor-trainers/ui/WordOrderTrainer";
import { useActorPage } from "../model/useActorPage";
import "./style.css";

export function ActorPageView() {
  const {
    projects,
    projectName,
    onProjectChange,
    steps,
    focusMode,
    setFocusMode,
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
  } = useActorPage();

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
                <button
                  type="button"
                  className="actor-topbar-btn"
                  data-active={focusMode ? "true" : "false"}
                  onClick={() => setFocusMode((v) => !v)}
                  title="Скрыть левое меню навигации и сосредоточиться на тренировке"
                >
                  {focusMode ? "Фокус: вкл" : "Фокус"}
                </button>
                <button
                  type="button"
                  className="actor-topbar-btn"
                  data-active={settingsHidden ? "true" : "false"}
                  onClick={() => setSettingsHidden((v) => !v)}
                >
                  {settingsHidden ? "Показать настройки" : "Скрыть настройки"}
                </button>
              </div>
              <div className="actor-topbar-meta">
                Проект: <b>{projectName || "—"}</b> · Роль: <b>{effectiveRoleTitle || "—"}</b> · Сцены:{" "}
                <b>{scenesLabel}</b>
              </div>
            </div>

            {!settingsHidden ? (
              <div className="actor-controls">
                <label className="actor-field">
                  <div className="actor-label">Проект</div>
                  <select
                    className="actor-select"
                    value={projectName}
                    onChange={(e) => onProjectChange(e.target.value)}
                    disabled={projects.length === 0}
                  >
                    {projects.length === 0 ? <option value="">Проектов нет</option> : null}
                    {projects.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
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
                  <select
                    className="actor-select"
                    value={effectiveRoleInfo?.id != null ? String(effectiveRoleInfo.id) : ""}
                    onChange={(e) => setRoleId(e.target.value)}
                    disabled={!myEmail || rolesLoading || rolesForActor.length === 0}
                  >
                    {rolesForActor.length === 0 ? (
                      <option value="">
                        {rolesLoading
                          ? "Загрузка ролей…"
                          : myEmail
                            ? "Нет ролей для вашего пользователя"
                            : "Профиль не загружен"}
                      </option>
                    ) : null}
                    {rolesForActor.map((r) => (
                      <option key={String(r.id)} value={String(r.id)}>
                        {String(r.title ?? r.key ?? r.id)}
                      </option>
                    ))}
                  </select>
                  <div className="actor-hint">
                    Реплики ищутся по спикеру в тексте шага (<b>[[РОЛЬ]]</b> или <b>РОЛЬ: текст</b>) и
                    сопоставляются по ключу роли и алиасам.
                  </div>
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
                      <button
                        type="button"
                        className="actor-step-btn"
                        onClick={() => setSelectedStepIds("all")}
                        disabled={!effectiveRoleInfo || phraseSteps.length === 0}
                      >
                        Все ({totalInAllSteps})
                      </button>
                      <button
                        type="button"
                        className="actor-step-btn"
                        onClick={() => setSelectedStepIds([])}
                        disabled={!effectiveRoleInfo || phraseSteps.length === 0}
                      >
                        Очистить
                      </button>
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
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const nextChecked = e.target.checked;
                                  setSelectedStepIds((prev) => {
                                    if (prev === "all") {
                                      if (nextChecked) return "all";
                                      return phraseSteps
                                        .map((x) => x.stepId)
                                        .filter((id) => id !== s.stepId);
                                    }
                                    const set = new Set(prev);
                                    if (nextChecked) set.add(s.stepId);
                                    else set.delete(s.stepId);
                                    return Array.from(set.values()).sort((a, b) => a - b);
                                  });
                                }}
                                aria-label={`Выбрать шаг ${s.stepTitle}`}
                              />
                              <div className="actor-step-main">
                                <div className="actor-step-title">
                                  {s.stepTitle}{" "}
                                  <span className="actor-step-id">#{s.stepId}</span>
                                </div>
                                {examples.length > 0 ? (
                                  <div className="actor-step-examples">
                                    {examples.map((ex, idx) => (
                                      <div
                                        key={`${s.stepId}-ex-${idx}`}
                                        className="actor-step-example"
                                      >
                                        “{String(ex.text).slice(0, 90)}
                                        {ex.text.length > 90 ? "…" : ""}”
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <span
                                className="actor-step-count"
                                title="Количество реплик вашей роли в этом шаге"
                              >
                                {s.count}
                              </span>
                              <button
                                type="button"
                                className="actor-step-open"
                                onClick={(ev) => {
                                  ev.preventDefault();
                                  ev.stopPropagation();
                                  openStepInScript(s.stepId);
                                }}
                                title="Открыть этот шаг в сценарии"
                              >
                                Открыть
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="actor-hint">
                    “Сцена” здесь = шаг сценария (карточка). Тренажёр берёт реплики только из выбранных шагов.
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
                <button
                  type="button"
                  className={`actor-mode-tab ${trainerMode === "dialogue" ? "active" : ""}`}
                  onClick={() => setTrainerMode("dialogue")}
                  role="tab"
                  aria-selected={trainerMode === "dialogue"}
                >
                  Диалог
                </button>
                <button
                  type="button"
                  className={`actor-mode-tab ${trainerMode === "cards" ? "active" : ""}`}
                  onClick={() => setTrainerMode("cards")}
                  role="tab"
                  aria-selected={trainerMode === "cards"}
                >
                  Переставь слова (карточки)
                </button>
                <button
                  type="button"
                  className={`actor-mode-tab ${trainerMode === "voice" ? "active" : ""}`}
                  onClick={() => setTrainerMode("voice")}
                  role="tab"
                  aria-selected={trainerMode === "voice"}
                >
                  Голос
                </button>
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
                <WordOrderTrainer
                  phrases={filteredPhrases}
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
