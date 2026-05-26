import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../auth";
import type {
  DirectorRehearsalSession,
  DirectorSessionSlot,
} from "../../directorSessionsSync";
import {
  useDirectorSessionsBundleQuery,
  useLazyProjectMaterialQuery,
  useReplaceDirectorSessionsMutation,
} from "../../api/director-sessions-api";
import { projectMaterialToDirectorSessionCache } from "../../model/build-project-data-cache";
import { useProfilesBatchQuery } from "../../../profile/api/profile-api";
import { projectApi, useProjectMembersQuery, useProjectRolesQuery } from "../../../project/api/project-api";
import { useAppDispatch } from "../../../../shared/store/hooks";
import { useProject } from "../../../project";
import { RehearsalsCard } from "../../../rehearsals-card/RehearsalsCard";
import type { ScriptStep } from "../../../../shared/types/script";
import { markdownToPlainText } from "../../../../shared/utils/textPreview";
import type { TeamProfile } from "../../../../sync/api/profile";
import "../../../../pages/sessions/style.css";
import "./style.css";
import {
  classifyActorSlotAvailability,
  directorSlotRefKey,
  formatSlotTime,
  getSessionStartLocalMinutes,
  isReadyStep,
  looksLikeEmail,
  memberEmailsFromProjectMembers,
  normalizeEmail,
  roleMapsFromProjectRoles,
  toDateKey,
} from "../../model/session-page-utils";
import type { DirectorSessionProjectDataCache } from "../../model/session-page-types";
import {
  getAllAssigneeEmailsForDirectorSlotChart,
  getNormalizedRoleKeysForSlotStep,
  getRolePlannedEmailsForDirectorSlot,
  type DirectorSlotPlannedData,
} from "../../model/session-slot-planned";
import { DirectorSessionSlotsPanel } from "../DirectorSessionSlotsPanel";
import { SlotRoleRehearsalPicker } from "../SlotRoleRehearsalPicker";
import { TroupeSchedulePreview } from "../TroupeSchedulePreview";

dayjs.locale("ru");

export function DirectorSessionPage() {
  const dispatch = useAppDispatch();
  const { accessToken } = useAuth();
  const { projects } = useProject();
  const navigate = useNavigate();

  const { sessionId, slotId } = useParams();
  const sid = String(sessionId ?? "").trim();
  const slId =
    slotId != null && String(slotId).trim() !== "" ? String(slotId).trim() : "";

  const [sessions, setSessions] = useState<DirectorRehearsalSession[]>([]);
  const [session, setSession] = useState<DirectorRehearsalSession | null>(null);
  const [slot, setSlot] = useState<DirectorSessionSlot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    data: sessionsBundle,
    isLoading: bundleLoading,
    error: bundleQueryError,
  } = useDirectorSessionsBundleQuery(undefined, {
    skip: !accessToken || !sid,
  });
  const [replaceSessions] = useReplaceDirectorSessionsMutation();
  const [fetchProjectMaterial] = useLazyProjectMaterialQuery();

  const [dataCache, setDataCache] = useState<DirectorSessionProjectDataCache>({});
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);
  /** Роли по slug проекта — для расчёта тонов всех слотов (разные проекты в одной сессии). */
  const [roleEmailsByProjectSlug, setRoleEmailsByProjectSlug] = useState<
    Record<string, Record<string, string[]>>
  >({});

  const visibleProjects = useMemo(
    () =>
      (Array.isArray(projects) ? projects : [])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru")),
    [projects],
  );

  const projectFilterStorageKey = useMemo(
    () => `directorSessions:session:${sid}:${slId || "all"}:project`,
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

  useEffect(() => {
    if (!accessToken || !sid) return;
    if (bundleLoading) return;
    if (!sessionsBundle) {
      const msg =
        (bundleQueryError as { message?: string } | undefined)?.message ??
        "Не удалось загрузить сессию";
      setError(msg);
      return;
    }
    const list = sessionsBundle.sessions ?? [];
    setSessions(list);
    const s = list.find((x) => x.id === sid) ?? null;
    if (!s) {
      setSession(null);
      setSlot(null);
      setError("Сессия не найдена");
      return;
    }
    setSession(s);
    if (!slId) {
      setSlot(null);
      setError(null);
      return;
    }
    const sl = (s.slots ?? []).find((x) => x.id === slId) ?? null;
    setSlot(sl);
    if (!sl) {
      const n = (s.slots ?? []).length;
      setError(
        n === 0
          ? "Слотов пока нет — добавь первый в блоке «Слоты» слева."
          : null,
      );
    } else {
      setError(null);
    }
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
    const s = next.find((x) => x.id === sid) ?? null;
    setSession(s);
    if (!s) {
      setSlot(null);
      return;
    }
    if (slId) {
      setSlot((s.slots ?? []).find((x) => x.id === slId) ?? null);
    } else {
      setSlot(null);
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

  const projectSlugsInSession = useMemo(() => {
    const s = new Set<string>();
    for (const sl of session?.slots ?? []) {
      const u = String(sl.ref?.projectSlug ?? "").trim();
      if (u) s.add(u);
    }
    return Array.from(s).sort();
  }, [session?.id, session?.slots]);

  const projectDataLoadedSig = useMemo(
    () =>
      projectSlugsInSession.filter((slug) => dataCache[slug] != null).join("|"),
    [dataCache, projectSlugsInSession],
  );

  useEffect(() => {
    if (!accessToken || projectSlugsInSession.length === 0) return;
    for (const slug of projectSlugsInSession) {
      if (dataCache[slug] != null) continue;
      void loadProjectData(slug);
    }
  }, [accessToken, projectSlugsInSession.join("|"), projectDataLoadedSig]);

  useEffect(() => {
    if (!accessToken || projectSlugsInSession.length === 0) {
      setRoleEmailsByProjectSlug({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        projectSlugsInSession.map(async (slug) => {
          try {
            const rolesRes = await dispatch(
              projectApi.endpoints.projectRoles.initiate(slug),
            ).unwrap();
            return [
              slug,
              roleMapsFromProjectRoles(rolesRes.roles).roleEmailsByKey,
            ] as const;
          } catch {
            return [slug, {}] as const;
          }
        }),
      );
      if (!cancelled) {
        setRoleEmailsByProjectSlug(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, dispatch, projectSlugsInSession.join("|")]);

  const slotPlannerEmails = useMemo(() => {
    if (!session) return [];
    const set = new Set<string>();
    for (const sl of session.slots ?? []) {
      const ref = sl.ref;
      if (!ref?.projectSlug || ref.stepId == null) continue;
      const slug = String(ref.projectSlug).trim();
      const cached = dataCache[slug];
      const rem = roleEmailsByProjectSlug[slug];
      if (!cached?.steps?.length || !rem) continue;
      const plannedData: DirectorSlotPlannedData = {
        steps: cached.steps,
        sceneRoles: cached.sceneRoles ?? null,
        roleEmailsByKey: rem,
      };
      const byRole = getRolePlannedEmailsForDirectorSlot(
        slug,
        ref.stepId,
        plannedData,
        null,
      );
      for (const { emails } of byRole) {
        for (const e of emails) {
          const n = normalizeEmail(String(e ?? ""));
          if (n && looksLikeEmail(n)) set.add(n);
        }
      }
    }
    return Array.from(set);
  }, [session, session?.slots, dataCache, roleEmailsByProjectSlug]);

  const { data: plannerProfiles = [] } = useProfilesBatchQuery(
    slotPlannerEmails,
    { skip: !accessToken || slotPlannerEmails.length === 0 },
  );

  const profilesForSlotTones = useMemo(() => {
    const m = new Map<string, TeamProfile>();
    for (const p of teamProfiles ?? []) {
      const e = normalizeEmail((p as any)?.email);
      if (e) m.set(e, p);
    }
    for (const p of plannerProfiles ?? []) {
      const e = normalizeEmail((p as any)?.email);
      if (e) m.set(e, p);
    }
    return m;
  }, [teamProfiles, plannerProfiles]);

  /** Цвет слота по графику полного состава ролей (чекбоксы репетиции не учитываются). */
  const slotRehearsalToneClassById = useMemo(() => {
    const out = new Map<string, string>();
    if (!session || !sessionDateKey) return out;
    const base = getSessionStartLocalMinutes(session.startsAt);

    for (const sl of session.slots ?? []) {
      const ref = sl.ref;
      if (!ref?.projectSlug || ref.stepId == null) continue;
      const slug = String(ref.projectSlug).trim();
      const cached = dataCache[slug];
      const rem = roleEmailsByProjectSlug[slug];
      if (!cached?.steps?.length || !rem) continue;

      const plannedData: DirectorSlotPlannedData = {
        steps: cached.steps,
        sceneRoles: cached.sceneRoles ?? null,
        roleEmailsByKey: rem,
      };

      const byRole = getRolePlannedEmailsForDirectorSlot(
        slug,
        ref.stepId,
        plannedData,
        null,
      );
      if (byRole.length === 0) continue;

      const startMin = base + Math.max(0, Math.floor(sl.offsetMin || 0));
      const endMin = startMin + Math.max(1, Math.floor(sl.durationMin || 1));

      let allRolesOk = true;
      for (const { emails } of byRole) {
        if (emails.length === 0) {
          allRolesOk = false;
          break;
        }
        const roleOk = emails.some((normEmail) => {
          const prof = profilesForSlotTones.get(
            normalizeEmail(String(normEmail ?? "")),
          );
          return (
            classifyActorSlotAvailability(
              prof,
              sessionDateKey,
              startMin,
              endMin,
            ) === "free"
          );
        });
        if (!roleOk) {
          allRolesOk = false;
          break;
        }
      }

      out.set(
        sl.id,
        allRolesOk ? "session-slot--rehearsal-ok" : "session-slot--rehearsal-bad",
      );
    }
    return out;
  }, [
    session?.id,
    session?.startsAt,
    session?.slots,
    sessionDateKey,
    dataCache,
    roleEmailsByProjectSlug,
    profilesForSlotTones,
  ]);

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

  const freeRolesNormSet = useMemo(() => {
    const set = new Set<string>();
    if (!sessionDateKey || !slotWindow) return set;
    const roleEmails = roleEmailsByKey ?? {};
    const profMap = profilesForSlotTones;
    for (const [rk, emails] of Object.entries(roleEmails)) {
      if (!rk || !Array.isArray(emails) || emails.length === 0) continue;
      const ok = emails.some((raw) => {
        const email = normalizeEmail(String(raw ?? ""));
        if (!email || !looksLikeEmail(email)) return false;
        const p = profMap.get(email);
        return (
          classifyActorSlotAvailability(
            p,
            sessionDateKey,
            slotWindow.startMin,
            slotWindow.endMin,
          ) === "free"
        );
      });
      if (ok) set.add(rk);
    }
    return set;
  }, [roleEmailsByKey, sessionDateKey, slotWindow, profilesForSlotTones]);

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
    const pack = projectFilter ? dataCache[projectFilter] : null;
    const sceneRoles = pack?.sceneRoles ?? null;

    for (const s of list) {
      const roleKeysNorm = getNormalizedRoleKeysForSlotStep(
        s,
        sceneRoles,
        s.id,
      );
      const roles = roleKeysNorm.map(
        (rk) => roleTitleByKey[rk] ?? rk,
      );
      const missing: string[] = [];
      for (const normKey of roleKeysNorm) {
        if (normKey && !freeSet.has(normKey)) {
          missing.push(roleTitleByKey[normKey] ?? normKey);
        }
      }
      out.push({ step: s, ok: missing.length === 0, missing, roles });
    }
    return out;
  }, [freeRolesNormSet, steps, dataCache, projectFilter, roleTitleByKey]);

  const stepsForList = useMemo(() => {
    if (!onlySelectable) return selectableSteps;
    return selectableSteps.filter((x) => x.ok);
  }, [onlySelectable, selectableSteps]);

  /** Шаги (project + stepId), которые уже привязаны к какому-либо слоту этой сессии */
  const slotsByStepRefInSession = useMemo(() => {
    const map = new Map<string, DirectorSessionSlot[]>();
    if (!session?.slots?.length) return map;
    for (const sl of session.slots) {
      const r = sl.ref;
      if (!r?.projectSlug) continue;
      const stepId = Math.floor(Number(r.stepId) || 0);
      if (!Number.isFinite(stepId) || stepId <= 0) continue;
      const k = directorSlotRefKey(r.projectSlug, stepId);
      const arr = map.get(k) ?? [];
      arr.push(sl);
      map.set(k, arr);
    }
    return map;
  }, [session?.id, session?.slots]);

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
    const step = slotPlannedInput.steps.find((s) => s.id === stepId) ?? null;
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
    return (
      <div style={{ padding: 12 }}>
        Нужно войти, чтобы открыть страницу сессии.
      </div>
    );
  if (!sid) return <div style={{ padding: 12 }}>Некорректный адрес.</div>;

  return (
    <div className="director-session-page">
      <div className="director-session-page__head">
        <Link
          to={`/sessions?sessionId=${encodeURIComponent(sid)}`}
          className="director-session-page__back"
        >
          ← К списку сессий
        </Link>
      </div>

      {loading ? (
        <div style={{ marginTop: 10, opacity: 0.75 }}>Загрузка…</div>
      ) : null}
      {error ? (
        <div className="settings-invite-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      ) : null}

      {session ? (
        <>
          <div className="director-session-page__title">{session.title}</div>
        </>
      ) : (
        <div className="director-session-page__title">Сессия</div>
      )}
      {session && !loading && (
        <div className="director-session-page__grid">
          <DirectorSessionSlotsPanel
            session={session}
            sessions={sessions}
            slotToneClassById={slotRehearsalToneClassById}
            selectedSlotId={slId || null}
            onSelectSlot={(id) =>
              navigate(
                `/sessions/${encodeURIComponent(sid)}/slots/${encodeURIComponent(id)}`,
              )
            }
            onRequestCloseSlot={() =>
              navigate(`/sessions/${encodeURIComponent(sid)}`)
            }
            onNoSlotsLeft={() =>
              navigate(`/sessions/${encodeURIComponent(sid)}`, {
                replace: true,
              })
            }
            persistSessions={persistSessions}
            slotSettings={
              slot ? (
                <div className="director-session-page__detail-grid">
                  <RehearsalsCard
                    fluid
                    title=""
                    className="director-session-page__preview"
                  >
                    {selectedStep && (
                      <div className="session__step-item">
                        <PreviewSlot selectedStep={selectedStep} />

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
                      placeholder="Например: темп, акценты, на что обратить внимание…"
                      rows={4}
                    />

                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    ></div>
                  </RehearsalsCard>

                  <RehearsalsCard fluid title="">
                    <div style={{ marginTop: 10 }}>
                      <div
                        style={{
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
                    </div>
                    <div className="session__steps-checkbox">
                      <LabeledCheckbox
                        checked={onlySelectable}
                        onChange={(e) => setOnlySelectable(e)}
                      >
                        <span className="">по доступности актёров</span>
                      </LabeledCheckbox>
                    </div>

                    {stepsLoading ? (
                      <div className="session__steps-list">Загружаю шаги…</div>
                    ) : null}
                    {stepsError ? (
                      <div
                        className="settings-invite-error"
                        style={{ marginTop: 10 }}
                      >
                        {stepsError}
                      </div>
                    ) : null}
                    {availabilityError ? (
                      <div
                        className="settings-invite-error"
                        style={{ marginTop: 10 }}
                      >
                        {availabilityError}
                      </div>
                    ) : null}

                    <div className="session__steps-list">
                      {stepsForList.slice(0, 250).map((stepData) => {
                        const s = stepData.step;
                        const isSelected = Boolean(
                          slot.ref &&
                          slot.ref.projectSlug === projectFilter &&
                          slot.ref.stepId === s.id,
                        );
                        const ok = stepData.ok;
                        const refKey = directorSlotRefKey(projectFilter, s.id);
                        const slotsWithSameRef =
                          slotsByStepRefInSession.get(refKey) ?? [];
                        const otherSlotsWithRef = slotsWithSameRef.filter(
                          (sl) => sl.id !== slot.id,
                        );
                        const bookedInOtherSlots = otherSlotsWithRef.length > 0;
                        const otherSlotsTimesLabel =
                          bookedInOtherSlots && session
                            ? (() => {
                                const sorted = [...otherSlotsWithRef].sort(
                                  (a, b) => a.offsetMin - b.offsetMin,
                                );
                                if (sorted.length === 1) {
                                  return formatSlotTime(
                                    session.startsAt,
                                    sorted[0].offsetMin,
                                  );
                                }
                                if (sorted.length === 2) {
                                  return `${formatSlotTime(session.startsAt, sorted[0].offsetMin)} · ${formatSlotTime(session.startsAt, sorted[1].offsetMin)}`;
                                }
                                return `${formatSlotTime(session.startsAt, sorted[0].offsetMin)} +${sorted.length - 1}`;
                              })()
                            : "";
                        const assignTitle =
                          bookedInOtherSlots && session
                            ? `Назначить в этот слот. Уже в сессии: ${[
                                ...otherSlotsWithRef,
                              ]
                                .sort((a, b) => a.offsetMin - b.offsetMin)
                                .map((sl) =>
                                  formatSlotTime(
                                    session.startsAt,
                                    sl.offsetMin,
                                  ),
                                )
                                .join(", ")}`
                            : "Назначить в этот слот";
                        return (
                          <button
                            className={cn("session__step-item", {
                              "session__step-item--selected": isSelected,
                              "session__step-item--ok": !isSelected && ok,
                              "session__step-item--bad": !isSelected && !ok,
                              "session__step-item--booked":
                                bookedInOtherSlots && !isSelected,
                            })}
                            key={`${projectFilter}:${s.id}`}
                            type="button"
                            onClick={() =>
                              void updateSlot({
                                ref: {
                                  projectSlug: projectFilter,
                                  stepId: s.id,
                                },
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
                            title={assignTitle}
                          >
                            <div
                              className="session__step-item__title"
                              style={{ fontWeight: 900, fontSize: 12 }}
                            >
                              <span className="session__step-item__title-text">
                                #{s.id} {s.title || "\u00a0"}
                              </span>
                              {bookedInOtherSlots ? (
                                <span
                                  className="session__step-item__badge session__step-item__badge--in-session"
                                  aria-hidden
                                >
                                  в сессии
                                  {otherSlotsTimesLabel ? (
                                    <span className="session__step-item__badge-detail">
                                      {" "}
                                      · {otherSlotsTimesLabel}
                                    </span>
                                  ) : null}
                                </span>
                              ) : null}
                            </div>
                            <div
                              className="session__step-item__status"
                              style={{ fontSize: 12, opacity: 0.72 }}
                            >
                              {isReadyStep(s) ? "Готова" : "В работе"}
                              {s.durationMin != null
                                ? ` · длит.: ${Math.max(1, Math.floor(Number(s.durationMin) || 1))} мин`
                                : ""}
                              {" · "}
                              {ok ? (
                                <span
                                  style={{
                                    color: "var(--color-status-success-text)",
                                    fontWeight: 800,
                                  }}
                                >
                                  можно взять
                                </span>
                              ) : (
                                <span
                                  style={{
                                    color: "var(--color-status-error-text)",
                                    fontWeight: 800,
                                  }}
                                >
                                  не собирается
                                </span>
                              )}
                            </div>
                            <div
                              className={cn(
                                "session__step-item__missing",
                                !(!ok && stepData.missing.length > 0) &&
                                  "session__step-item__missing--empty",
                              )}
                            >
                              {!ok && stepData.missing.length > 0 ? (
                                <>
                                  не хватает:{" "}
                                  <b>
                                    {stepData.missing.slice(0, 6).join(", ")}
                                  </b>
                                  {stepData.missing.length > 6
                                    ? ` +${stepData.missing.length - 6}`
                                    : ""}
                                </>
                              ) : (
                                "\u00a0"
                              )}
                            </div>
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
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

const PreviewSlot = ({ selectedStep }: { selectedStep: any }) => {
  return (
    <pre className="director-session-page__preview-pre">
      {(() => {
        const text = String(
          (selectedStep as any).playMarkdown ??
            (selectedStep as any).markdown ??
            "",
        );
        const plain = markdownToPlainText(text);
        return (
          plain.slice(0, 1600) + (plain.length > 1600 ? "\n\n… (обрезано)" : "")
        );
      })()}
    </pre>
  );
};
