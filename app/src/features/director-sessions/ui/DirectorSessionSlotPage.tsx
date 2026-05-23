import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
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
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import { extractRolesSmart } from "../../rehearsals/model/rehearsals-page-utils";
import type { ScriptStep } from "../../../shared/types/script";
import { markdownToPlainText } from "../../../shared/utils/textPreview";
import type { TeamProfile } from "../../../sync/api/profile";
import {
  formatSlotTime,
  formatTimeHHMM,
  getRangesForDateMinutes,
  getSessionStartLocalMinutes,
  isReadyStep,
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
  getNormalizedRoleKeysForSlotStep,
  type DirectorSlotPlannedData,
} from "../model/session-slot-planned";
import { SlotRoleRehearsalPicker } from "./SlotRoleRehearsalPicker";
import { TroupeSchedulePreview } from "./TroupeSchedulePreview";
import "../../../pages/sessions/style.css";

dayjs.locale("ru");

export function DirectorSessionSlotPage() {
  const { accessToken } = useAuth();
  const { projects } = useProject();
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
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);

  const visibleProjects = useMemo(
    () =>
      (Array.isArray(projects) ? projects : [])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru")),
    [projects],
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
    setSessions(next);
    try {
      await replaceSessions({ sessions: next }).unwrap();
    } catch (e: unknown) {
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
    setStepsLoading(true);
    setStepsError(null);
    try {
      const data = await fetchProjectMaterial(slug).unwrap();
      setDataCache((p) => ({
        ...p,
        [slug]: projectMaterialToDirectorSessionCache(data),
      }));
    } catch (e: unknown) {
      const err = e as { message?: string; data?: { message?: string } };
      setStepsError(
        err?.data?.message ?? err?.message ?? "Не удалось загрузить шаги",
      );
      setDataCache((p) => ({
        ...p,
        [slug]: { steps: [], sceneId: null, sceneRoles: null },
      }));
    } finally {
      setStepsLoading(false);
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

  const steps = useMemo(() => {
    const src = projectFilter ? (dataCache[projectFilter]?.steps ?? []) : [];
    const base = src.filter((s) => !isReadyStep(s));
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

  const selectableSteps = useMemo(() => {
    const out: Array<{
      step: ScriptStep;
      ok: boolean;
      missing: string[];
      roles: string[];
    }> = [];
    const list = steps;
    const freeSet = freeRolesNormSet;
    for (const s of list) {
      const text = String((s as any).playMarkdown ?? (s as any).markdown ?? "");
      const roles = extractRolesSmart(text);
      const missing: string[] = [];
      for (const r of roles) {
        const norm = normalizeRoleKey(r);
        if (norm && !freeSet.has(norm)) missing.push(r);
      }
      out.push({ step: s, ok: missing.length === 0, missing, roles });
    }
    return out;
  }, [freeRolesNormSet, steps]);

  const stepsForList = useMemo(() => {
    if (!onlySelectable) return selectableSteps;
    return selectableSteps.filter((x) => x.ok);
  }, [onlySelectable, selectableSteps]);

  const selectedStep = useMemo(() => {
    if (!slot?.ref) return null;
    const slug = slot.ref.projectSlug;
    const id = slot.ref.stepId;
    const data = dataCache[slug];
    return data?.steps?.find((s) => s.id === id) ?? null;
  }, [dataCache, slot?.ref]);

  const slotPlannedInput = useMemo((): DirectorSlotPlannedData | null => {
    if (!slot?.ref) return null;
    const slug = String(slot.ref.projectSlug ?? "").trim();
    const cached = dataCache[slug];
    return {
      steps: cached?.steps ?? [],
      sceneRoles: cached?.sceneRoles ?? null,
      roleEmailsByKey,
    };
  }, [slot?.ref, dataCache, roleEmailsByKey]);

  const slotRoleKeysForPicker = useMemo(() => {
    if (!slot?.ref || !slotPlannedInput) return [];
    const stepId = slot.ref.stepId;
    const step =
      slotPlannedInput.steps.find((s) => s.id === stepId) ?? null;
    return getNormalizedRoleKeysForSlotStep(
      step,
      slotPlannedInput.sceneRoles,
      stepId,
    );
  }, [slot?.ref, slotPlannedInput]);

  const slotChartEmailSet = useMemo(() => {
    if (!slot?.ref || !slotPlannedInput) return undefined;
    const slug = String(slot.ref.projectSlug ?? "").trim();
    const list = getAllAssigneeEmailsForDirectorSlotChart(
      slug,
      slot.ref.stepId,
      slotPlannedInput,
    );
    return new Set(list);
  }, [slot?.ref, slotPlannedInput]);

  if (!accessToken)
    return <div style={{ padding: 12 }}>Нужно войти, чтобы открыть слот.</div>;
  if (!sid || !slId)
    return <div style={{ padding: 12 }}>Некорректный URL слота.</div>;

  return (
    <div
      style={{ padding: "12px 12px 40px", maxWidth: 1100, margin: "0 auto" }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Link
          to={`/sessions?sessionId=${encodeURIComponent(sid)}`}
          style={{ textDecoration: "none", color: "inherit", opacity: 0.85 }}
        >
          ← К сессии
        </Link>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Слот</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{headerTimeLabel}</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{slotTimeLabel}</div>
      </div>

      {loading ? (
        <div style={{ marginTop: 10, opacity: 0.75 }}>Загрузка…</div>
      ) : null}
      {error ? (
        <div className="settings-invite-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      ) : null}

      {session && slot && !loading && !error && (
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr 1.2fr",
            alignItems: "start",
          }}
        >
          <RehearsalsCard fluid title="Текущий выбор">
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
              {slot.ref ? (
                <>
                  <div>
                    Проект: <b>{slot.ref.projectSlug}</b>
                  </div>
                  <div>
                    Шаг: <b>#{slot.ref.stepId}</b>
                  </div>
                </>
              ) : (
                <div>Материал не выбран.</div>
              )}
            </div>

            {selectedStep && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 900 }}>Превью</div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                  {selectedStep.title ? selectedStep.title : "—"}
                </div>
                <pre
                  style={{
                    marginTop: 8,
                    whiteSpace: "pre-wrap",
                    maxHeight: 260,
                    overflow: "auto",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.20)",
                    fontSize: 12,
                    lineHeight: 1.35,
                  }}
                >
                  {(() => {
                    const text = String(
                      (selectedStep as any).playMarkdown ??
                        (selectedStep as any).markdown ??
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

            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  void updateSlot({
                    ref: undefined,
                    roleRehearsalPicks: undefined,
                  })
                }
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                  color: "inherit",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                Снять материал
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate(`/sessions?sessionId=${encodeURIComponent(sid)}`)
                }
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                  color: "inherit",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                Готово
              </button>
            </div>
          </RehearsalsCard>

          <RehearsalsCard fluid title="Выбор сцены/шага">
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <select
                className="native-select"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                {visibleProjects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                className="native-text-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="поиск по названию/тексту"
                style={{ flex: 1, minWidth: 240 }}
              />
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  gap: 8,
                  alignItems: "center",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={onlySelectable}
                  onChange={(e) => setOnlySelectable(e.target.checked)}
                />
                <span style={{ fontSize: 12, opacity: 0.85 }}>
                  по доступности актёров
                </span>
              </label>
              {(membersLoading || rolesLoading) && (
                <span style={{ fontSize: 12, opacity: 0.75 }}>
                  подгружаю роли/участников…
                </span>
              )}
              {sessionDateKey && slotWindow ? (
                <span style={{ fontSize: 12, opacity: 0.75 }}>
                  окно слота: <b>{sessionDateKey}</b> ·{" "}
                  {formatTimeHHMM(slotWindow.startMin)}–
                  {formatTimeHHMM(slotWindow.endMin)}
                </span>
              ) : (
                <span style={{ fontSize: 12, opacity: 0.75 }}>
                  нет даты/времени для расчёта доступности
                </span>
              )}
            </div>

            {stepsLoading ? (
              <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
                Загружаю шаги…
              </div>
            ) : null}
            {stepsError ? (
              <div className="settings-invite-error" style={{ marginTop: 10 }}>
                {stepsError}
              </div>
            ) : null}
            {availabilityError ? (
              <div className="settings-invite-error" style={{ marginTop: 10 }}>
                {availabilityError}
              </div>
            ) : null}

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gap: 8,
                maxHeight: 620,
                overflow: "auto",
                paddingRight: 4,
              }}
            >
              {stepsForList.slice(0, 250).map((x) => {
                const s = x.step;
                const isSelected = Boolean(
                  slot.ref &&
                  slot.ref.projectSlug === projectFilter &&
                  slot.ref.stepId === s.id,
                );
                const ok = x.ok;
                return (
                  <button
                    key={`${projectFilter}:${s.id}`}
                    type="button"
                    onClick={() =>
                      void updateSlot({
                        ref: { projectSlug: projectFilter, stepId: s.id },
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
                    style={{
                      textAlign: "left",
                      borderRadius: 12,
                      border: isSelected
                        ? "1px solid rgba(96,165,250,0.55)"
                        : ok
                          ? "1px solid rgba(46,160,67,0.28)"
                          : "1px solid rgba(248,81,73,0.22)",
                      background: isSelected
                        ? "rgba(96,165,250,0.10)"
                        : ok
                          ? "rgba(46,160,67,0.08)"
                          : "rgba(248,81,73,0.06)",
                      padding: "10px 10px",
                      cursor: "pointer",
                      color: "inherit",
                      display: "grid",
                      gap: 4,
                    }}
                    title="Назначить в этот слот"
                  >
                    <div style={{ fontWeight: 900, fontSize: 12 }}>
                      #{s.id} {s.title}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.72 }}>
                      {isReadyStep(s) ? "Готова" : "В работе"}
                      {s.durationMin != null
                        ? ` · длит.: ${Math.max(1, Math.floor(Number(s.durationMin) || 1))} мин`
                        : ""}
                      {" · "}
                      {ok ? (
                        <span
                          style={{
                            color: "rgba(126, 231, 135, 0.95)",
                            fontWeight: 800,
                          }}
                        >
                          можно взять
                        </span>
                      ) : (
                        <span
                          style={{
                            color: "rgba(248, 81, 73, 0.95)",
                            fontWeight: 800,
                          }}
                        >
                          не собирается
                        </span>
                      )}
                    </div>
                    {!ok && x.missing.length > 0 && (
                      <div style={{ fontSize: 12, opacity: 0.85 }}>
                        не хватает: <b>{x.missing.slice(0, 6).join(", ")}</b>
                        {x.missing.length > 6
                          ? ` +${x.missing.length - 6}`
                          : ""}
                      </div>
                    )}
                  </button>
                );
              })}
              {stepsForList.length === 0 && !stepsLoading && (
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Нет шагов (или сцена не найдена).
                </div>
              )}
            </div>
          </RehearsalsCard>
        </div>
      )}
    </div>
  );
}
