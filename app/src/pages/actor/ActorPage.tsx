import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import { useScene } from "../../features/scene";
import { useNavigate } from "react-router-dom";
import {
  buildRoleAssignmentsIndex,
  extractRolePhrasesFromSteps,
  type RolePhraseSource,
} from "../../features/actor-trainers/model/rolePhrases";
import { WordOrderTrainer } from "../../features/actor-trainers/ui/WordOrderTrainer";
import { DialogueSceneTrainer } from "../../features/actor-trainers/ui/DialogueSceneTrainer";
import { getMyProfile } from "../../sync/api";
import "./style.css";

function normalizeActorKey(v: string): string {
  return String(v ?? "").trim().toLowerCase();
}

function normalizeRoleKeyForStorage(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

export function ActorPage() {
  const { accessToken } = useAuth();
  const { projects, projectName, onProjectChange } = useProject();
  const { steps, sceneData } = useScene();
  const navigate = useNavigate();

  const [myEmail, setMyEmail] = useState<string>("");
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setMyEmail("");
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    getMyProfile(accessToken)
      .then((p) => {
        if (cancelled) return;
        const email = String(p?.email ?? "").trim().toLowerCase();
        setMyEmail(email);
      })
      .catch(() => {
        if (!cancelled) setMyEmail("");
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const roleIndex = useMemo(() => {
    return buildRoleAssignmentsIndex({
      steps,
      roleAssignments: (sceneData?.roleAssignments ?? {}) as Record<string, string[]>,
    });
  }, [steps, sceneData?.roleAssignments]);

  const rolesForActor = useMemo(() => {
    const aKey = normalizeActorKey(myEmail);
    if (!aKey) return [];
    const roles: string[] = [];
    for (const { role, actors } of roleIndex.values()) {
      if (actors.some((x) => normalizeActorKey(x) === aKey)) roles.push(role);
    }
    return roles.sort((a, b) => a.localeCompare(b, "ru"));
  }, [myEmail, roleIndex]);

  const [role, setRole] = useState<string>("");
  const effectiveRole = useMemo(() => {
    if (role && rolesForActor.includes(role)) return role;
    return rolesForActor[0] || "";
  }, [role, rolesForActor]);

  useEffect(() => {
    if (role && !rolesForActor.includes(role)) {
      setRole("");
    }
  }, [role, rolesForActor]);

  const phrases: RolePhraseSource[] = useMemo(() => {
    if (!effectiveRole) return [];
    return extractRolePhrasesFromSteps({
      steps,
      role: effectiveRole,
      preferField: "playMarkdown",
    });
  }, [effectiveRole, steps]);

  const phraseSteps = useMemo(() => {
    const map = new Map<number, { stepId: number; stepTitle: string; count: number }>();
    for (const p of phrases) {
      const prev = map.get(p.stepId);
      if (prev) map.set(p.stepId, { ...prev, count: prev.count + 1 });
      else map.set(p.stepId, { stepId: p.stepId, stepTitle: p.stepTitle, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => a.stepId - b.stepId);
  }, [phrases]);

  const phrasesByStep = useMemo(() => {
    const map = new Map<number, RolePhraseSource[]>();
    for (const p of phrases) {
      const arr = map.get(p.stepId);
      if (arr) arr.push(p);
      else map.set(p.stepId, [p]);
    }
    return map;
  }, [phrases]);

  const [selectedStepIds, setSelectedStepIds] = useState<number[] | "all">("all");

  // Keep selection valid when role/project changes
  const phraseStepIdSet = useMemo(() => new Set(phraseSteps.map((s) => s.stepId)), [phraseSteps]);
  const normalizedSelectedStepIds = useMemo(() => {
    if (selectedStepIds === "all") return "all" as const;
    const uniq = Array.from(new Set(selectedStepIds)).filter((id) => phraseStepIdSet.has(id));
    return uniq;
  }, [phraseStepIdSet, selectedStepIds]);

  const filteredPhrases = useMemo(() => {
    if (normalizedSelectedStepIds === "all") return phrases;
    if (normalizedSelectedStepIds.length === 0) return [];
    const allowed = new Set(normalizedSelectedStepIds);
    return phrases.filter((p) => allowed.has(p.stepId));
  }, [phrases, normalizedSelectedStepIds]);

  const totalInAllSteps = useMemo(
    () => phraseSteps.reduce((acc, s) => acc + s.count, 0),
    [phraseSteps],
  );

  const trainerStorageKey = useMemo(() => {
    if (!projectName || !myEmail || !effectiveRole) return "";
    return [
      "actorTrainer",
      "wordOrder",
      projectName,
      normalizeActorKey(myEmail),
      normalizeRoleKeyForStorage(effectiveRole),
    ].join(":");
  }, [effectiveRole, myEmail, projectName]);

  const dialogueStorageKey = useMemo(() => {
    if (!projectName || !myEmail || !effectiveRole) return "";
    return [
      "actorTrainer",
      "dialogue",
      projectName,
      normalizeActorKey(myEmail),
      normalizeRoleKeyForStorage(effectiveRole),
    ].join(":");
  }, [effectiveRole, myEmail, projectName]);

  useEffect(() => {
    // When switching role/project, default back to full scope
    setSelectedStepIds("all");
  }, [effectiveRole, projectName]);

  const [trainerMode, setTrainerMode] = useState<"dialogue" | "cards">("dialogue");

  const selectedStepIdsForTraining = useMemo(() => {
    if (normalizedSelectedStepIds === "all") {
      // "Все" означает "все шаги, где есть реплики выбранной роли" (то, что показано в пикере)
      return phraseSteps.map((s) => s.stepId);
    }
    return normalizedSelectedStepIds;
  }, [normalizedSelectedStepIds, phraseSteps]);

  return (
    <div className="app-layout actor-layout">
      <div className="app-content">
        <main className="main-content actor-main">
          <div className="actor-view">
            <h2>Актёр</h2>
            <p className="actor-subtitle">
              Тренажёры для заучивания текста роли.
            </p>

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
                <div className="actor-hint">Роли показываются только для текущего пользователя.</div>
              </label>

              <label className="actor-field">
                <div className="actor-label">Роль</div>
                <select
                  className="actor-select"
                  value={effectiveRole}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={!myEmail || rolesForActor.length === 0}
                >
                  {rolesForActor.length === 0 ? (
                    <option value="">
                      {myEmail ? "Нет ролей для вашего пользователя" : "Профиль не загружен"}
                    </option>
                  ) : null}
                  {rolesForActor.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <div className="actor-hint">
                  Реплики роли извлекаются по <b>[[{effectiveRole || "РОЛЬ"}]]</b> в тексте шага.
                </div>
              </label>

              <label className="actor-field">
                <div className="actor-label">Сцены (шаги) для тренировки</div>
                <div className="actor-step-picker">
                  <div className="actor-step-picker-actions">
                    <button
                      type="button"
                      className="actor-step-btn"
                      onClick={() => setSelectedStepIds("all")}
                      disabled={!effectiveRole || phraseSteps.length === 0}
                    >
                      Все ({totalInAllSteps})
                    </button>
                    <button
                      type="button"
                      className="actor-step-btn"
                      onClick={() => setSelectedStepIds([])}
                      disabled={!effectiveRole || phraseSteps.length === 0}
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
                      <div className="actor-hint">Нет шагов с репликами выбранной роли.</div>
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
                                    // When all selected: unchecking one -> all except this.
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
                                {s.stepTitle} <span className="actor-step-id">#{s.stepId}</span>
                              </div>
                              {examples.length > 0 ? (
                                <div className="actor-step-examples">
                                  {examples.map((ex, idx) => (
                                    <div key={`${s.stepId}-ex-${idx}`} className="actor-step-example">
                                      “{String(ex.text).slice(0, 90)}
                                      {ex.text.length > 90 ? "…" : ""}”
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <span className="actor-step-count" title="Количество реплик вашей роли в этом шаге">
                              {s.count}
                            </span>
                            <button
                              type="button"
                              className="actor-step-open"
                              onClick={(ev) => {
                                ev.preventDefault();
                                ev.stopPropagation();
                                if (!projectName) return;
                                localStorage.setItem(`selectedStepId:${projectName}`, String(s.stepId));
                                navigate("/");
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
                  Карточки (переставь слова)
                </button>
              </div>

              {trainerMode === "dialogue" ? (
                <DialogueSceneTrainer
                  steps={steps}
                  role={effectiveRole}
                  selectedStepIds={selectedStepIdsForTraining}
                  storageKey={dialogueStorageKey || undefined}
                />
              ) : (
                <WordOrderTrainer phrases={filteredPhrases} storageKey={trainerStorageKey || undefined} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

