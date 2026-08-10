import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth";
import type {
  DirectorRehearsalSession,
  DirectorSessionSlot,
} from "../directorSessionsSync";
import {
  useDirectorSessionsBundleQuery,
  useLazyProjectMaterialQuery,
  useReplaceDirectorSessionsMutation,
} from "../api/director-sessions-api";
import { projectMaterialToDirectorSessionCache } from "../model/build-project-data-cache";
import { useProfilesBatchQuery } from "../../profile/api/profile-api";
import {
  useProjectMembersQuery,
  useProjectRolesQuery,
} from "../../project/api/project-api";
import { useProject } from "../../project";
import { projectSessionPath } from "../../../app/router/paths";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import { extractRolesSmart } from "../../rehearsals/model/rehearsals-page-utils";
import type { ScriptScene } from "../../../shared/types/script";
import { markdownToPlainText } from "../../../shared/utils/textPreview";
import type { TeamProfile } from "../../../sync/api/profile";
import {
  formatSlotTime,
  formatTimeHHMM,
  getRangesForDateMinutes,
  getSessionStartLocalMinutes,
  isReadyScene,
  isSlotInsideRanges,
  looksLikeEmail,
  memberEmailsFromProjectMembers,
  normalizeEmail,
  normalizeRoleKey,
  roleMapsFromProjectRoles,
  toDateKey,
} from "../model/session-page-utils";
import type { DirectorSessionProjectDataCache } from "../model/session-page-types";
import {
  getAllAssigneeEmailsForDirectorSlotChart,
  getNormalizedRoleKeysForSlotScene,
  type DirectorSlotPlannedData,
} from "../model/session-slot-planned";
import { SlotRoleRehearsalPicker } from "./SlotRoleRehearsalPicker";
import { TroupeSchedulePreview } from "./TroupeSchedulePreview";
import "./director-sessions.css";
import "./DirectorSessionSlotPage.css";

dayjs.locale("ru");

export function DirectorSessionSlotPage() {
  const { accessToken } = useAuth();
  const { projectName, projects, projectItems } = useProject();
  const navigate = useNavigate();

  const { sessionId, slotId } = useParams();
  const sid = String(sessionId ?? "").trim();
  const slId = String(slotId ?? "").trim();

  const [sessions, setSessions] = useState<DirectorRehearsalSession[]>([]);
  const [session, setSession] = useState<DirectorRehearsalSession | null>(null);
  const [slot, setSlot] = useState<DirectorSessionSlot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    data: sessionsBundle,
    isLoading: bundleLoading,
    error: bundleQueryError,
  } = useDirectorSessionsBundleQuery(undefined, {
    skip: !accessToken || !sid || !slId,
  });
  const [replaceSessions] = useReplaceDirectorSessionsMutation();
  const [fetchProjectMaterial] = useLazyProjectMaterialQuery();

  const [dataCache, setDataCache] = useState<DirectorSessionProjectDataCache>({});
  const [scenesLoading, setScenesLoading] = useState(false);
  const [scenesError, setScenesError] = useState<string | null>(null);

  const visibleProjects = useMemo(
    () =>
      (Array.isArray(projects) ? projects : [])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru")),
    [projects],
  );
  const projectLabelBySlug = useMemo(
    () =>
      new Map(
        projectItems.map((project) => [
          project.slug,
          project.name || project.slug,
        ]),
      ),
    [projectItems],
  );

  const projectFilterStorageKey = useMemo(
    () => `directorSessions:slot:${sid}:${slId}:project`,
    [sid, slId],
  );
  const [projectFilter, setProjectFilter] = useState<string>(() => {
    try {
      return (
        (typeof window !== "undefined"
          ? localStorage.getItem(projectFilterStorageKey)
          : null) ||
        (typeof window !== "undefined"
          ? localStorage.getItem("selectedProject")
          : null) ||
        ""
      );
    } catch (_) {
      return "";
    }
  });
  const [query, setQuery] = useState("");
  const [onlySelectable, setOnlySelectable] = useState(false);

  const rolesSlug = useMemo(() => {
    const fromSlot = (slot?.ref?.projectSlug ?? "").trim();
    return fromSlot || projectFilter;
  }, [slot?.ref?.projectSlug, projectFilter]);

  useEffect(() => {
    if (!accessToken || !sid || !slId) return;
    if (bundleLoading) return;
    if (!sessionsBundle) {
      const msg =
        (bundleQueryError as { message?: string } | undefined)?.message ??
        "Не удалось загрузить слот";
      setError(msg);
      return;
    }
    setError(null);
    const list = sessionsBundle.sessions ?? [];
    setSessions(list);
    const s = list.find((x) => x.id === sid) ?? null;
    if (!s) {
      setSession(null);
      setSlot(null);
      setError("Сессия не найдена");
      return;
    }
    const sl = (s.slots ?? []).find((x) => x.id === slId) ?? null;
    if (!sl) {
      setSession(s);
      setSlot(null);
      setError("Слот не найден");
      return;
    }
    setSession(s);
    setSlot(sl);
  }, [accessToken, sid, slId, sessionsBundle, bundleLoading, bundleQueryError]);

  const loading = bundleLoading;

  useEffect(() => {
    if (!visibleProjects.length) return;
    setProjectFilter((prev) => {
      const chosen = prev && visibleProjects.includes(prev) ? prev : "";
      return chosen || visibleProjects[0] || "";
    });
  }, [visibleProjects]);

  useEffect(() => {
    try {
      if (projectFilter)
        localStorage.setItem(projectFilterStorageKey, projectFilter);
    } catch (_) {}
  }, [projectFilter, projectFilterStorageKey]);

  const sessionDateKey = useMemo(() => {
    if (!session?.startsAt) return null;
    const d = new Date(session.startsAt);
    return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
  }, [session?.startsAt]);

  const slotWindow = useMemo(() => {
    if (!session || !slot) return null;
    const base = getSessionStartLocalMinutes(session.startsAt);
    const startMin = base + Math.max(0, Math.floor(slot.offsetMin || 0));
    const endMin = startMin + Math.max(1, Math.floor(slot.durationMin || 1));
    return { startMin, endMin };
  }, [session, slot]);

  const persistSessions = async (next: DirectorRehearsalSession[]) => {
    if (!accessToken) return;
    const previousSessions = sessions;
    const previousSession = session;
    const previousSlot = slot;
    const nextSession = next.find((item) => item.id === sid) ?? null;
    const nextSlot =
      nextSession?.slots.find((item) => item.id === slId) ?? null;

    setSessions(next);
    setSession(nextSession);
    setSlot(nextSlot);
    setError(null);
    try {
      await replaceSessions({ sessions: next }).unwrap();
    } catch (e: unknown) {
      setSessions(previousSessions);
      setSession(previousSession);
      setSlot(previousSlot);
      const err = e as { message?: string; data?: { message?: string } };
      setError(
        err?.data?.message ?? err?.message ?? "Не удалось сохранить сессию",
      );
      throw e;
    }
  };

  const updateSlotById = useCallback(
    async (targetSlotId: string, patch: Partial<DirectorSessionSlot>) => {
      if (!session) return;
      const nextSessions = (sessions ?? []).map((s) => {
        if (s.id !== session.id) return s;
        return {
          ...s,
          slots: (s.slots ?? []).map((sl) =>
            sl.id === targetSlotId ? { ...sl, ...patch } : sl,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
      await persistSessions(nextSessions);
      const nextSession = nextSessions.find((x) => x.id === session.id) ?? null;
      setSession(nextSession);
      setSlot((prev) => {
        if (!prev || prev.id !== targetSlotId) return prev;
        return (
          nextSession?.slots?.find((x) => x.id === targetSlotId) ?? null
        );
      });
    },
    [session, sessions, persistSessions],
  );

  const updateSlot = useCallback(
    async (patch: Partial<DirectorSessionSlot>) => {
      if (!slot) return;
      await updateSlotById(slot.id, patch);
    },
    [slot, updateSlotById],
  );

  const persistSlotNotes = useCallback(
    (targetSlotId: string, notes: string) => {
      void updateSlotById(targetSlotId, { notes });
    },
    [updateSlotById],
  );

  const {
    draft: slotNotesDraft,
    onChange: onSlotNotesChange,
    onBlur: onSlotNotesBlur,
  } = useDebouncedSyncedText(slot?.id, slot?.notes, persistSlotNotes);

  const loadProjectData = async (slug: string) => {
    if (!accessToken) return;
    if (!slug) return;
    if (dataCache[slug]) return;
    setScenesLoading(true);
    setScenesError(null);
    try {
      const data = await fetchProjectMaterial(slug).unwrap();
      setDataCache((p) => ({
        ...p,
        [slug]: projectMaterialToDirectorSessionCache(data),
      }));
    } catch (e: unknown) {
      const err = e as { message?: string; data?: { message?: string } };
      setScenesError(
        err?.data?.message ?? err?.message ?? "Не удалось загрузить сцены",
      );
      setDataCache((p) => ({
        ...p,
        [slug]: { scenes: [], sceneId: null, sceneRoles: null },
      }));
    } finally {
      setScenesLoading(false);
    }
  };

  useEffect(() => {
    if (!projectFilter) return;
    void loadProjectData(projectFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  useEffect(() => {
    if (!rolesSlug || rolesSlug === projectFilter) return;
    void loadProjectData(rolesSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesSlug, projectFilter]);

  const {
    data: membersRes,
    isLoading: membersLoading,
    error: membersQueryError,
  } = useProjectMembersQuery(rolesSlug, {
    skip: !accessToken || !rolesSlug,
  });

  const {
    data: rolesRes,
    isLoading: rolesLoading,
    error: rolesQueryError,
  } = useProjectRolesQuery(rolesSlug, {
    skip: !accessToken || !rolesSlug,
  });

  const projectMemberEmails = useMemo(
    () => memberEmailsFromProjectMembers(membersRes),
    [membersRes],
  );

  const { roleEmailsByKey, roleTitleByKey } = useMemo(
    () => roleMapsFromProjectRoles(rolesRes?.roles),
    [rolesRes?.roles],
  );

  const {
    data: teamProfiles = [],
    error: profilesQueryError,
  } = useProfilesBatchQuery(projectMemberEmails, {
    skip: !accessToken || projectMemberEmails.length === 0,
  });

  const availabilityError = useMemo(() => {
    const pick = (e: unknown, fallback: string) => {
      const msg = (e as { message?: string } | undefined)?.message;
      return msg ? msg : fallback;
    };
    if (membersQueryError)
      return pick(membersQueryError, "Не удалось загрузить участников проекта");
    if (rolesQueryError)
      return pick(rolesQueryError, "Не удалось загрузить роли проекта");
    if (profilesQueryError)
      return pick(profilesQueryError, "Не удалось загрузить профили участников");
    return null;
  }, [membersQueryError, rolesQueryError, profilesQueryError]);

  const freeRolesNormSet = useMemo(() => {
    const set = new Set<string>();
    if (!sessionDateKey) return set;
    if (!slotWindow) return set;
    const roleEmails = roleEmailsByKey ?? {};
    for (const p of teamProfiles ?? []) {
      const email = normalizeEmail((p as any)?.email);
      if (!email) continue;
      if (!looksLikeEmail(email)) continue;
      const cal = (p as any)?.availabilityCalendar as
        | Record<string, string>
        | undefined;
      const st =
        cal?.[sessionDateKey] === "present"
          ? "present"
          : cal?.[sessionDateKey] === "absent"
            ? "absent"
            : "unknown";
      if (st !== "present") continue;
      const ranges = getRangesForDateMinutes(p, sessionDateKey);
      if (ranges.length > 0) {
        if (!isSlotInsideRanges(slotWindow.startMin, slotWindow.endMin, ranges))
          continue;
      }
      for (const [rk, emails] of Object.entries(roleEmails)) {
        if (!rk) continue;
        if (!Array.isArray(emails) || emails.length === 0) continue;
        if (!emails.includes(email)) continue;
        set.add(rk);
      }
    }
    return set;
  }, [roleEmailsByKey, sessionDateKey, slotWindow, teamProfiles]);

  const headerTimeLabel = useMemo(() => {
    if (!session?.startsAt) return "";
    return dayjs(session.startsAt).format("D MMMM YYYY, HH:mm");
  }, [session?.startsAt]);

  const slotTimeLabel = useMemo(() => {
    if (!session || !slot) return "";
    return `${formatSlotTime(session.startsAt, slot.offsetMin)} · ${slot.durationMin} мин`;
  }, [session, slot]);

  const filteredScenes = useMemo(() => {
    const src = projectFilter ? (dataCache[projectFilter]?.scenes ?? []) : [];
    const base = src.filter((s) => !isReadyScene(s));
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((s) => {
      const inTitle = String(s.title ?? "")
        .toLowerCase()
        .includes(q);
      const inText = markdownToPlainText(
        String((s as any).playMarkdown ?? (s as any).markdown ?? ""),
      )
        .toLowerCase()
        .includes(q);
      return inTitle || inText;
    });
  }, [dataCache, projectFilter, query]);

  const selectableScenes = useMemo(() => {
    const out: Array<{
      scene: ScriptScene;
      ok: boolean;
      missing: string[];
      roles: string[];
    }> = [];
    const list = filteredScenes;
    const freeSet = freeRolesNormSet;
    for (const s of list) {
      const text = String((s as any).playMarkdown ?? (s as any).markdown ?? "");
      const roles = extractRolesSmart(text);
      const missing: string[] = [];
      for (const r of roles) {
        const norm = normalizeRoleKey(r);
        if (norm && !freeSet.has(norm)) missing.push(r);
      }
      out.push({ scene: s, ok: missing.length === 0, missing, roles });
    }
    return out;
  }, [freeRolesNormSet, filteredScenes]);

  const scenesForList = useMemo(() => {
    if (!onlySelectable) return selectableScenes;
    return selectableScenes.filter((x) => x.ok);
  }, [onlySelectable, selectableScenes]);

  const selectedScene = useMemo(() => {
    if (!slot?.ref) return null;
    const slug = slot.ref.projectSlug;
    const id = slot.ref.sceneId;
    const data = dataCache[slug];
    return data?.scenes?.find((s) => s.id === id) ?? null;
  }, [dataCache, slot?.ref]);

  const slotPlannedInput = useMemo((): DirectorSlotPlannedData | null => {
    if (!slot?.ref) return null;
    const slug = String(slot.ref.projectSlug ?? "").trim();
    const cached = dataCache[slug];
    return {
      scenes: cached?.scenes ?? [],
      sceneRoles: cached?.sceneRoles ?? null,
      roleEmailsByKey,
    };
  }, [slot?.ref, dataCache, roleEmailsByKey]);

  const slotRoleKeysForPicker = useMemo(() => {
    if (!slot?.ref || !slotPlannedInput) return [];
    const sceneId = slot.ref.sceneId;
    const scene =
      slotPlannedInput.scenes.find((s) => s.id === sceneId) ?? null;
    return getNormalizedRoleKeysForSlotScene(
      scene,
      slotPlannedInput.sceneRoles,
      sceneId,
    );
  }, [slot?.ref, slotPlannedInput]);

  const slotChartEmailSet = useMemo(() => {
    if (!slot?.ref || !slotPlannedInput) return undefined;
    const slug = String(slot.ref.projectSlug ?? "").trim();
    const list = getAllAssigneeEmailsForDirectorSlotChart(
      slug,
      slot.ref.sceneId,
      slotPlannedInput,
    );
    return new Set(list);
  }, [slot?.ref, slotPlannedInput]);

  if (!accessToken) {
    return (
      <div className="director-session-slot-page__message">
        Нужно войти, чтобы открыть слот.
      </div>
    );
  }
  if (!sid || !slId) {
    return (
      <div className="director-session-slot-page__message">
        Некорректный URL слота.
      </div>
    );
  }

  return (
    <div className="director-session-slot-page">
      <div className="director-session-slot-page__header">
        <Link
          to={`${projectSessionPath(projectName)}?sessionId=${encodeURIComponent(sid)}`}
          className="director-session-slot-page__back-link"
        >
          ← К сессии
        </Link>
        <div className="director-session-slot-page__title">Слот</div>
        <div className="director-session-slot-page__meta">{headerTimeLabel}</div>
        <div className="director-session-slot-page__meta">{slotTimeLabel}</div>
      </div>

      {loading ? (
        <div className="director-session-slot-page__loading">Загрузка…</div>
      ) : null}
      {error ? (
        <div className="settings-invite-error director-session-slot-page__error">
          {error}
        </div>
      ) : null}

      {session && slot && !loading && !error && (
        <div className="director-session-slot-page__grid">
          <RehearsalsCard fluid title="Текущий выбор">
            <div className="director-session-slot-page__selection-summary">
              {slot.ref ? (
                <>
                  <div>
                    Проект:{" "}
                    <b>
                      {projectLabelBySlug.get(slot.ref.projectSlug) ??
                        slot.ref.projectSlug}
                    </b>
                  </div>
                  <div>
                    Картина / сцена: <b>#{slot.ref.sceneId}</b>
                  </div>
                </>
              ) : (
                <div>Материал не выбран.</div>
              )}
            </div>

            {selectedScene && (
              <div className="director-session-slot-page__preview">
                <div className="director-session-slot-page__preview-title">Превью</div>
                <div className="director-session-slot-page__preview-scene-title">
                  {selectedScene.title ? selectedScene.title : "—"}
                </div>
                <pre className="director-session-slot-page__preview-text">
                  {(() => {
                    const text = String(
                      (selectedScene as any).playMarkdown ??
                        (selectedScene as any).markdown ??
                        "",
                    );
                    const plain = markdownToPlainText(text);
                    return (
                      plain.slice(0, 1600) +
                      (plain.length > 1600 ? "\n\n… (обрезано)" : "")
                    );
                  })()}
                </pre>
                <TroupeSchedulePreview
                  sessionDateKey={sessionDateKey}
                  profiles={teamProfiles}
                  membersLoading={membersLoading}
                  participantEmailSet={slotChartEmailSet}
                />
                <SlotRoleRehearsalPicker
                  roleKeys={slotRoleKeysForPicker}
                  roleTitleByKey={roleTitleByKey}
                  roleEmailsByKey={roleEmailsByKey}
                  picks={slot.roleRehearsalPicks}
                  profiles={teamProfiles}
                  onPicksChange={(next) =>
                    void updateSlot({ roleRehearsalPicks: next })
                  }
                />
              </div>
            )}

            <FormTextarea
              rootClassName="form-textarea--section"
              label="Заметки к слоту"
              value={slotNotesDraft}
              onChange={(e) => onSlotNotesChange(e.target.value)}
              onBlur={onSlotNotesBlur}
              placeholder="Например: темп, ключевой акцент, кого проверить…"
              rows={4}
            />

            <div className="director-session-slot-page__actions">
              <button
                type="button"
                className="director-session-slot-page__action-btn"
                onClick={() =>
                  void updateSlot({
                    ref: undefined,
                    roleRehearsalPicks: undefined,
                  })
                }
              >
                Снять материал
              </button>
              <button
                type="button"
                className="director-session-slot-page__action-btn"
                onClick={() =>
                  navigate(
                    `${projectSessionPath(projectName)}?sessionId=${encodeURIComponent(sid)}`,
                  )
                }
              >
                Готово
              </button>
            </div>
          </RehearsalsCard>

          <RehearsalsCard fluid title="Выбор сцены">
            <div className="director-session-slot-page__filters">
              <select
                className="native-select"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                {visibleProjects.map((p) => (
                  <option key={p} value={p}>
                    {projectLabelBySlug.get(p) ?? p}
                  </option>
                ))}
              </select>
              <input
                className={cn(
                  "native-text-input",
                  "director-session-slot-page__search-input",
                )}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="поиск по названию/тексту"
              />
            </div>

            <div className="director-session-slot-page__availability-bar">
              <label className="director-session-slot-page__availability-label">
                <input
                  type="checkbox"
                  checked={onlySelectable}
                  onChange={(e) => setOnlySelectable(e.target.checked)}
                />
                <span className="director-session-slot-page__availability-label-text">
                  по доступности актёров
                </span>
              </label>
              {(membersLoading || rolesLoading) && (
                <span className="director-session-slot-page__availability-hint">
                  подгружаю роли/участников…
                </span>
              )}
              {sessionDateKey && slotWindow ? (
                <span className="director-session-slot-page__availability-hint">
                  окно слота: <b>{sessionDateKey}</b> ·{" "}
                  {formatTimeHHMM(slotWindow.startMin)}–
                  {formatTimeHHMM(slotWindow.endMin)}
                </span>
              ) : (
                <span className="director-session-slot-page__availability-hint">
                  нет даты/времени для расчёта доступности
                </span>
              )}
            </div>

            {scenesLoading ? (
              <div className="director-session-slot-page__loading">
                Загружаю сцены…
              </div>
            ) : null}
            {scenesError ? (
              <div className="settings-invite-error director-session-slot-page__error">
                {scenesError}
              </div>
            ) : null}
            {availabilityError ? (
              <div className="settings-invite-error director-session-slot-page__error">
                {availabilityError}
              </div>
            ) : null}

            <div className="director-session-slot-page__scene-list">
              {scenesForList.slice(0, 250).map((x) => {
                const s = x.scene;
                const isSelected = Boolean(
                  slot.ref &&
                  slot.ref.projectSlug === projectFilter &&
                  slot.ref.sceneId === s.id,
                );
                const ok = x.ok;
                return (
                  <button
                    key={`${projectFilter}:${s.id}`}
                    type="button"
                    className={cn(
                      "director-session-slot-page__scene-item",
                      ok && "director-session-slot-page__scene-item--ok",
                      isSelected && "director-session-slot-page__scene-item--selected",
                    )}
                    onClick={() =>
                      void updateSlot({
                        title:
                          String(s.title ?? "").trim() || `Сцена #${s.id}`,
                        ref: { projectSlug: projectFilter, sceneId: s.id },
                        durationMin:
                          s.durationMin == null
                            ? slot.durationMin
                            : Math.max(
                                1,
                                Math.floor(Number(s.durationMin) || 1),
                              ),
                        roleRehearsalPicks: undefined,
                      })
                    }
                    title="Назначить в этот слот"
                  >
                    <div className="director-session-slot-page__scene-item-title">
                      #{s.id} {s.title}
                    </div>
                    <div className="director-session-slot-page__scene-item-meta">
                      {isReadyScene(s) ? "Готова" : "В работе"}
                      {s.durationMin != null
                        ? ` · длит.: ${Math.max(1, Math.floor(Number(s.durationMin) || 1))} мин`
                        : ""}
                      {" · "}
                      {ok ? (
                        <span className="director-session-slot-page__scene-item-status--ok">
                          можно взять
                        </span>
                      ) : (
                        <span className="director-session-slot-page__scene-item-status--bad">
                          не собирается
                        </span>
                      )}
                    </div>
                    {!ok && x.missing.length > 0 && (
                      <div className="director-session-slot-page__scene-item-missing">
                        не хватает: <b>{x.missing.slice(0, 6).join(", ")}</b>
                        {x.missing.length > 6
                          ? ` +${x.missing.length - 6}`
                          : ""}
                      </div>
                    )}
                  </button>
                );
              })}
              {scenesForList.length === 0 && !scenesLoading && (
                <div className="director-session-slot-page__empty">
                  Нет сцен (или сценарий не найден).
                </div>
              )}
            </div>
          </RehearsalsCard>
        </div>
      )}
    </div>
  );
}
