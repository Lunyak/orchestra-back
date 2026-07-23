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
import type { ScriptScene } from "../../../../shared/types/script";
import { markdownToPlainText } from "../../../../shared/utils/textPreview";
import type { TeamProfile } from "../../../../sync/api/profile";
import { RehearsalPlanSectionChrome } from "../../../../shared/components/rehearsal-plan/RehearsalPlanSectionChrome";
import "../director-sessions.css";
import "./style.css";
import {
  classifyActorSlotAvailability,
  directorSlotRefKey,
  formatSlotTime,
  getSessionStartLocalMinutes,
  isReadyScene,
  looksLikeEmail,
  memberEmailsFromProjectMembers,
  normalizeEmail,
  roleMapsFromProjectRoles,
  toDateKey,
} from "../../model/session-page-utils";
import type { DirectorSessionProjectDataCache } from "../../model/session-page-types";
import {
  getAllAssigneeEmailsForDirectorSlotChart,
  getNormalizedRoleKeysForSlotScene,
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
  const { projects, projectItems } = useProject();
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
  const [scenesLoading, setScenesLoading] = useState(false);
  const [scenesError, setScenesError] = useState<string | null>(null);
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
      if (!ref?.projectSlug || ref.sceneId == null) continue;
      const slug = String(ref.projectSlug).trim();
      const cached = dataCache[slug];
      const rem = roleEmailsByProjectSlug[slug];
      if (!cached?.scenes?.length || !rem) continue;
      const plannedData: DirectorSlotPlannedData = {
        scenes: cached.scenes,
        sceneRoles: cached.sceneRoles ?? null,
        roleEmailsByKey: rem,
      };
      const byRole = getRolePlannedEmailsForDirectorSlot(
        slug,
        ref.sceneId,
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
      if (!ref?.projectSlug || ref.sceneId == null) continue;
      const slug = String(ref.projectSlug).trim();
      const cached = dataCache[slug];
      const rem = roleEmailsByProjectSlug[slug];
      if (!cached?.scenes?.length || !rem) continue;

      const plannedData: DirectorSlotPlannedData = {
        scenes: cached.scenes,
        sceneRoles: cached.sceneRoles ?? null,
        roleEmailsByKey: rem,
      };

      const byRole = getRolePlannedEmailsForDirectorSlot(
        slug,
        ref.sceneId,
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
    const pack = projectFilter ? dataCache[projectFilter] : null;
    const sceneRoles = pack?.sceneRoles ?? null;

    for (const s of list) {
      const roleKeysNorm = getNormalizedRoleKeysForSlotScene(
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
      out.push({ scene: s, ok: missing.length === 0, missing, roles });
    }
    return out;
  }, [freeRolesNormSet, filteredScenes, dataCache, projectFilter, roleTitleByKey]);

  const scenesForList = useMemo(() => {
    if (!onlySelectable) return selectableScenes;
    return selectableScenes.filter((x) => x.ok);
  }, [onlySelectable, selectableScenes]);

  /** Сцены (project + sceneId), которые уже привязаны к какому-либо слоту этой сессии */
  const slotsBySceneRefInSession = useMemo(() => {
    const map = new Map<string, DirectorSessionSlot[]>();
    if (!session?.slots?.length) return map;
    for (const sl of session.slots) {
      const r = sl.ref;
      if (!r?.projectSlug) continue;
      const sceneId = Math.floor(Number(r.sceneId) || 0);
      if (!Number.isFinite(sceneId) || sceneId <= 0) continue;
      const k = directorSlotRefKey(r.projectSlug, sceneId);
      const arr = map.get(k) ?? [];
      arr.push(sl);
      map.set(k, arr);
    }
    return map;
  }, [session?.id, session?.slots]);

  const selectedScene = useMemo(() => {
    if (!slot?.ref) return null;
    const slug = slot.ref.projectSlug;
    const id = slot.ref.sceneId;
    const data = dataCache[slug];
    return data?.scenes?.find((s) => s.id === id) ?? null;
  }, [dataCache, slot?.ref]);

  const slotDisplayById = useMemo(() => {
    const map = new Map<
      string,
      { projectLabel: string; materialLabel: string }
    >();
    for (const sl of session?.slots ?? []) {
      const ref = sl.ref;
      if (!ref?.projectSlug || ref.sceneId == null) {
        map.set(sl.id, {
          projectLabel: "Материал не выбран",
          materialLabel: "",
        });
        continue;
      }
      const slug = String(ref.projectSlug).trim();
      const scene = dataCache[slug]?.scenes?.find((s) => s.id === ref.sceneId);
      map.set(sl.id, {
        projectLabel: projectLabelBySlug.get(slug) ?? slug,
        materialLabel:
          String(scene?.title ?? "").trim() || "Материал загружается",
      });
    }
    return map;
  }, [dataCache, projectLabelBySlug, session?.slots]);

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
    const scene = slotPlannedInput.scenes.find((s) => s.id === sceneId) ?? null;
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
      <div className="director-session-page__message">
        Нужно войти, чтобы открыть страницу сессии.
      </div>
    );
  }
  if (!sid) {
    return (
      <div className="director-session-page__message">Некорректный адрес.</div>
    );
  }

  return (
    <div className="director-session-page">
      <RehearsalPlanSectionChrome activeTab="sessions">
      <div className="director-session-page__header">
        <Link
          to={`/sessions?sessionId=${encodeURIComponent(sid)}`}
          className="director-session-page__back"
        >
          ← К списку сессий
        </Link>
      </div>

      {loading ? (
        <div className="director-session-page__loading">Загрузка…</div>
      ) : null}
      {error ? (
        <div className="settings-invite-error director-session-page__error">
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
            slotDisplayById={slotDisplayById}
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
                    {selectedScene && (
                      <div className="session__selected-scene">
                        <PreviewSlot selectedScene={selectedScene} />

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

                  </RehearsalsCard>

                  <RehearsalsCard fluid title="">
                    <div className="session__scenes-filters">
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
                          "session__scenes-search-input",
                        )}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="поиск по названию/тексту"
                      />
                    </div>
                    <div className="session__scenes-checkbox">
                      <LabeledCheckbox
                        checked={onlySelectable}
                        onChange={(e) => setOnlySelectable(e)}
                      >
                        <span className="">по доступности актёров</span>
                      </LabeledCheckbox>
                    </div>

                    {scenesLoading ? (
                      <div className="session__scenes-list">Загружаю сцены…</div>
                    ) : null}
                    {scenesError ? (
                      <div className="settings-invite-error director-session-page__error">
                        {scenesError}
                      </div>
                    ) : null}
                    {availabilityError ? (
                      <div className="settings-invite-error director-session-page__error">
                        {availabilityError}
                      </div>
                    ) : null}

                    <div className="session__scenes-list">
                      {scenesForList.slice(0, 250).map((sceneData) => {
                        const s = sceneData.scene;
                        const isSelected = Boolean(
                          slot.ref &&
                          slot.ref.projectSlug === projectFilter &&
                          slot.ref.sceneId === s.id,
                        );
                        const ok = sceneData.ok;
                        const refKey = directorSlotRefKey(projectFilter, s.id);
                        const slotsWithSameRef =
                          slotsBySceneRefInSession.get(refKey) ?? [];
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
                            className={cn("session__scene-item", {
                              "session__scene-item--selected": isSelected,
                              "session__scene-item--ok": !isSelected && ok,
                              "session__scene-item--bad": !isSelected && !ok,
                              "session__scene-item--booked":
                                bookedInOtherSlots && !isSelected,
                            })}
                            key={`${projectFilter}:${s.id}`}
                            type="button"
                            onClick={() =>
                              void updateSlot({
                                ref: {
                                  projectSlug: projectFilter,
                                  sceneId: s.id,
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
                            <div className="session__scene-item__title">
                              <span className="session__scene-item__title-text">
                                #{s.id} {s.title || "\u00a0"}
                              </span>
                              {bookedInOtherSlots ? (
                                <span
                                  className="session__scene-item__badge session__scene-item__badge--in-session"
                                  aria-hidden
                                >
                                  в сессии
                                  {otherSlotsTimesLabel ? (
                                    <span className="session__scene-item__badge-detail">
                                      {" "}
                                      · {otherSlotsTimesLabel}
                                    </span>
                                  ) : null}
                                </span>
                              ) : null}
                            </div>
                            <div
                              className={cn(
                                "session__scene-item__missing",
                                !(!ok && sceneData.missing.length > 0) &&
                                  "session__scene-item__missing--empty",
                              )}
                            >
                              {!ok && sceneData.missing.length > 0 ? (
                                <>
                                  не хватает:{" "}
                                  <b>
                                    {sceneData.missing.slice(0, 6).join(", ")}
                                  </b>
                                  {sceneData.missing.length > 6
                                    ? ` +${sceneData.missing.length - 6}`
                                    : ""}
                                </>
                              ) : (
                                "\u00a0"
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {scenesForList.length === 0 && !scenesLoading && (
                        <div className="session__scenes-list__empty">
                          Нет сцен (или сценарий не найден).
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
      </RehearsalPlanSectionChrome>
    </div>
  );
}

const PreviewSlot = ({ selectedScene }: { selectedScene: any }) => {
  return (
    <pre className="director-session-page__preview-pre">
      {(() => {
        const text = String(
          (selectedScene as any).playMarkdown ??
            (selectedScene as any).markdown ??
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
