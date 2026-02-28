import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import { useScene } from "../../features/scene";
import { useNavigate } from "react-router-dom";
import {
  extractRolePhrasesFromSteps,
  type RolePhraseSource,
} from "../../features/actor-trainers/model/rolePhrases";
import { buildDialogueLines, normalizeRoleKey } from "../../features/actor-trainers/model/dialogue";
import { WordOrderTrainer } from "../../features/actor-trainers/ui/WordOrderTrainer";
import { DialogueSceneTrainer } from "../../features/actor-trainers/ui/DialogueSceneTrainer";
import { VoiceDialogueTrainer } from "../../features/actor-trainers/ui/VoiceDialogueTrainer";
import { getMyProfile, getProjectMembers, getProjectRoles, type ProjectRoleInfo } from "../../sync/api";
import { useAppDispatch, useAppSelector } from "../../shared/store/hooks";
import {
  actorTrainerUiActions,
  selectActorTrainerMode,
  type ActorTrainerMode,
} from "../../features/actor-trainers/model/actorTrainerUiSlice";
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
  const { steps } = useScene();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("actorPage:focusMode") === "true";
  });

  const [settingsHidden, setSettingsHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("actorPage:settingsHidden");
    if (stored === "true") return true;
    if (stored === "false") return false;
    return false;
  });

  const [myEmail, setMyEmail] = useState<string>("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [projectRoles, setProjectRoles] = useState<ProjectRoleInfo[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("actorPage:focusMode", String(focusMode));
    if (focusMode) setSettingsHidden(true);
  }, [focusMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("actorPage:settingsHidden", String(settingsHidden));
  }, [settingsHidden]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (focusMode) document.body.dataset.actorFocus = "true";
    else delete (document.body.dataset as any).actorFocus;
    return () => {
      delete (document.body.dataset as any).actorFocus;
    };
  }, [focusMode]);

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

  const [canPickAnyRole, setCanPickAnyRole] = useState<boolean>(false);
  useEffect(() => {
    if (!accessToken || !projectName || !myEmail) {
      setCanPickAnyRole(false);
      return;
    }
    let cancelled = false;
    getProjectMembers(accessToken, projectName)
      .then((res) => {
        if (cancelled) return;
        const me = normalizeActorKey(myEmail);
        const ownerEmail = normalizeActorKey(res?.owner?.email ?? "");
        const isOwner = Boolean(me && ownerEmail && ownerEmail === me);
        const isEditor = Boolean(
          me &&
            (res?.members ?? []).some(
              (m) =>
                normalizeActorKey(m?.user?.email ?? "") === me &&
                String(m?.role ?? "") === "editor",
            ),
        );
        setCanPickAnyRole(isOwner || isEditor);
      })
      .catch(() => {
        if (!cancelled) setCanPickAnyRole(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, myEmail, projectName]);

  useEffect(() => {
    if (!accessToken || !projectName) {
      setProjectRoles([]);
      setRolesLoading(false);
      setRolesError("");
      return;
    }
    let cancelled = false;
    setRolesLoading(true);
    setRolesError("");
    getProjectRoles(accessToken, projectName)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.roles) ? res.roles : [];
        list.sort((a, b) => String(a?.title ?? "").localeCompare(String(b?.title ?? ""), "ru"));
        setProjectRoles(list);
      })
      .catch((e) => {
        if (cancelled) return;
        setProjectRoles([]);
        setRolesError(String(e?.message ?? "roles-load-failed"));
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, projectName]);

  const roleKeysMentionedInScript = useMemo(() => {
    const set = new Set<string>();
    const lines = buildDialogueLines({ steps, preferField: "playMarkdown" });
    for (const l of lines) {
      if (l.kind !== "utterance") continue;
      if (!l.role) continue;
      const k = normalizeRoleKey(l.role);
      if (k) set.add(k);
    }
    return set;
  }, [steps]);

  const rolesForActor = useMemo(() => {
    const me = normalizeActorKey(myEmail);
    const list = Array.isArray(projectRoles) ? projectRoles : [];
    if (canPickAnyRole) return list;

    const assigned = list.filter((r) => (r?.emails ?? []).some((em) => normalizeActorKey(em) === me));
    if (assigned.length > 0) return assigned;

    // Fallback: allow training for roles that are present in script text (even if not assigned).
    // This matches user expectation: "прикрепил роль к сцене" => роль в тексте.
    const mentioned = list.filter((r) => {
      const keys = [
        normalizeRoleKey(r?.key ?? ""),
        normalizeRoleKey(r?.title ?? ""),
        ...((r?.aliases ?? []) as any[]).map((a) => normalizeRoleKey(String(a ?? ""))),
      ].filter(Boolean);
      return keys.some((k) => roleKeysMentionedInScript.has(k));
    });
    return mentioned;
  }, [canPickAnyRole, myEmail, projectRoles, roleKeysMentionedInScript]);

  const [roleId, setRoleId] = useState<string>("");

  const roleStorageKey = useMemo(() => {
    const actorKey = normalizeActorKey(myEmail);
    if (!projectName || !actorKey) return "";
    return ["actorPage", "selectedRole", projectName, actorKey].join(":");
  }, [myEmail, projectName]);

  // Restore last selected role for this project/user (if still available)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!roleStorageKey) return;
    if (rolesForActor.length === 0) return;
    const stored = String(localStorage.getItem(roleStorageKey) ?? "").trim();
    if (stored && rolesForActor.some((r) => String(r.id) === stored) && roleId !== stored) {
      setRoleId(stored);
      return;
    }
    // If current role is invalid/empty, prefer first available role
    if (!roleId || !rolesForActor.some((r) => String(r.id) === roleId)) {
      const first = rolesForActor[0]?.id;
      if (first != null) setRoleId(String(first));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleStorageKey, rolesForActor]);

  const effectiveRoleInfo = useMemo(() => {
    const wanted = roleId ? rolesForActor.find((r) => String(r.id) === String(roleId)) : null;
    return wanted || rolesForActor[0] || null;
  }, [roleId, rolesForActor]);
  const effectiveRoleTitle = useMemo(
    () => String(effectiveRoleInfo?.title ?? ""),
    [effectiveRoleInfo?.title],
  );
  const effectiveRoleKeys = useMemo(() => {
    if (!effectiveRoleInfo) return [];
    const out: string[] = [];
    // role.key is already normalized by backend, but we normalize anyway for safety.
    if (effectiveRoleInfo.key) out.push(normalizeRoleKey(effectiveRoleInfo.key));
    if (effectiveRoleInfo.title) out.push(normalizeRoleKey(effectiveRoleInfo.title));
    for (const a of effectiveRoleInfo.aliases ?? []) {
      if (!a) continue;
      out.push(normalizeRoleKey(a));
    }
    return Array.from(new Set(out.filter(Boolean)));
  }, [effectiveRoleInfo]);

  // Persist effective role selection
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!roleStorageKey) return;
    if (!effectiveRoleInfo?.id) return;
    try {
      localStorage.setItem(roleStorageKey, String(effectiveRoleInfo.id));
    } catch {
      // ignore
    }
  }, [effectiveRoleInfo?.id, roleStorageKey]);

  useEffect(() => {
    if (roleId && !rolesForActor.some((r) => String(r.id) === String(roleId))) {
      setRoleId("");
    }
  }, [roleId, rolesForActor]);

  const phrases: RolePhraseSource[] = useMemo(() => {
    if (!effectiveRoleInfo) return [];
    return extractRolePhrasesFromSteps({
      steps,
      role: effectiveRoleTitle || effectiveRoleInfo.key || "",
      roleKeys: effectiveRoleKeys,
      preferField: "playMarkdown",
    });
  }, [effectiveRoleInfo, effectiveRoleKeys, effectiveRoleTitle, steps]);

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
    const roleKey = effectiveRoleInfo?.key ? normalizeRoleKeyForStorage(effectiveRoleInfo.key) : "";
    if (!projectName || !myEmail || !roleKey) return "";
    return [
      "actorTrainer",
      "wordOrder",
      projectName,
      normalizeActorKey(myEmail),
      roleKey,
    ].join(":");
  }, [effectiveRoleInfo?.key, myEmail, projectName]);

  const dialogueStorageKey = useMemo(() => {
    const roleKey = effectiveRoleInfo?.key ? normalizeRoleKeyForStorage(effectiveRoleInfo.key) : "";
    if (!projectName || !myEmail || !roleKey) return "";
    return [
      "actorTrainer",
      "dialogue",
      projectName,
      normalizeActorKey(myEmail),
      roleKey,
    ].join(":");
  }, [effectiveRoleInfo?.key, myEmail, projectName]);

  const voiceStorageKey = useMemo(() => {
    const roleKey = effectiveRoleInfo?.key ? normalizeRoleKeyForStorage(effectiveRoleInfo.key) : "";
    if (!projectName || !myEmail || !roleKey) return "";
    return [
      "actorTrainer",
      "voice",
      projectName,
      normalizeActorKey(myEmail),
      roleKey,
    ].join(":");
  }, [effectiveRoleInfo?.key, myEmail, projectName]);

  useEffect(() => {
    // When switching role/project, default back to full scope
    setSelectedStepIds("all");
  }, [effectiveRoleInfo?.id, projectName]);

  const actorUiKey = useMemo(() => {
    const roleKey = effectiveRoleInfo?.key ? normalizeRoleKeyForStorage(effectiveRoleInfo.key) : "";
    if (!projectName || !myEmail || !roleKey) return "";
    return [
      "actorTrainer",
      "pageUi",
      projectName,
      normalizeActorKey(myEmail),
      roleKey,
    ].join(":");
  }, [effectiveRoleInfo?.key, myEmail, projectName]);

  useEffect(() => {
    if (!actorUiKey) return;
    dispatch(actorTrainerUiActions.initActorTrainerUi({ uiKey: actorUiKey }));
  }, [dispatch, actorUiKey]);

  const trainerModeFromStore = useAppSelector((s) =>
    actorUiKey ? selectActorTrainerMode(s, actorUiKey) : ("dialogue" as ActorTrainerMode),
  );
  const [trainerModeFallback, setTrainerModeFallback] = useState<ActorTrainerMode>("dialogue");
  const trainerMode: ActorTrainerMode = actorUiKey ? trainerModeFromStore : trainerModeFallback;

  const setTrainerMode = (mode: ActorTrainerMode) => {
    if (!actorUiKey) {
      setTrainerModeFallback(mode);
      return;
    }
    dispatch(actorTrainerUiActions.setTrainerMode({ uiKey: actorUiKey, value: mode }));
  };

  const selectedStepIdsForTraining = useMemo(() => {
    if (normalizedSelectedStepIds === "all") {
      // "Все" означает "все шаги, где есть реплики выбранной роли" (то, что показано в пикере)
      return phraseSteps.map((s) => s.stepId);
    }
    return normalizedSelectedStepIds;
  }, [normalizedSelectedStepIds, phraseSteps]);

  const scenesLabel = useMemo(() => {
    if (!effectiveRoleInfo) return "—";
    if (normalizedSelectedStepIds === "all") return `все (${phraseSteps.length})`;
    return `${normalizedSelectedStepIds.length} / ${phraseSteps.length}`;
  }, [effectiveRoleInfo, normalizedSelectedStepIds, phraseSteps.length]);

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
                    Похоже, роли не назначены на ваш email. Назначьте себя на роль на странице <b>Роли</b>.
                  </div>
                ) : null}
                {rolesError ? <div className="actor-hint">Ошибка загрузки ролей: {rolesError}</div> : null}
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
                <WordOrderTrainer phrases={filteredPhrases} storageKey={trainerStorageKey || undefined} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

