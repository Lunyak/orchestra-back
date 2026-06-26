import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import {
  extractRolePhrasesFromScenes,
  type RolePhraseSource,
} from "../../actor-trainers/model/rolePhrases";
import { buildDialogueLines, normalizeRoleKey } from "../../actor-trainers/model/dialogue";
import {
  actorTrainerUiActions,
  selectActorTrainerMode,
  type ActorTrainerMode,
} from "../../actor-trainers/model/actorTrainerUiSlice";
import { useMyProfileQuery } from "../../profile/api/profile-api";
import {
  useProjectMembersQuery,
  useProjectRolesQuery,
} from "../../project/api/project-api";
import { useProject } from "../../project";
import { usePlaybook } from "../../playbook";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { normalizeActorKey, normalizeRoleKeyForStorage } from "./actor-page-helpers";

export type ActorPageViewModel = ReturnType<typeof useActorPage>;

export function useActorPage() {
  const { accessToken } = useAuth();
  const {
    projects,
    projectItems,
    projectName,
    currentProjectDisplayName,
    onProjectChange,
  } = useProject();
  const { scenes, syncFromServer, isPlaybookReady } = usePlaybook();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [settingsHidden, setSettingsHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("actorPage:settingsHidden");
    if (stored === "true") return true;
    if (stored === "false") return false;
    return false;
  });

  const skipProject = !accessToken || !projectName;

  const { data: profile, isFetching: profileLoading } = useMyProfileQuery(undefined, {
    skip: !accessToken,
  });
  const myEmail = useMemo(
    () => normalizeActorKey(profile?.email ?? ""),
    [profile?.email],
  );

  const {
    data: rolesRes,
    isFetching: rolesLoading,
    error: rolesQueryError,
  } = useProjectRolesQuery(projectName!, { skip: skipProject });

  const projectRoles = useMemo(() => {
    const list = [...(rolesRes?.roles ?? [])];
    list.sort((a, b) =>
      String(a?.title ?? "").localeCompare(String(b?.title ?? ""), "ru"),
    );
    return list;
  }, [rolesRes?.roles]);

  const rolesError = rolesQueryError
    ? String(
        (rolesQueryError as { message?: string }).message ?? "roles-load-failed",
      )
    : "";

  const { data: membersRes } = useProjectMembersQuery(projectName!, {
    skip: skipProject || !myEmail,
  });

  const canPickAnyRole = useMemo(() => {
    if (!myEmail || !membersRes) return false;
    const me = normalizeActorKey(myEmail);
    const ownerEmail = normalizeActorKey(membersRes?.owner?.email ?? "");
    const isOwner = Boolean(me && ownerEmail && ownerEmail === me);
    const isEditor = Boolean(
      me &&
        (membersRes?.members ?? []).some(
          (m) =>
            normalizeActorKey(m?.user?.email ?? "") === me &&
            String(m?.role ?? "") === "editor",
        ),
    );
    return isOwner || isEditor;
  }, [membersRes, myEmail]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("actorPage:settingsHidden", String(settingsHidden));
  }, [settingsHidden]);

  const roleKeysMentionedInScript = useMemo(() => {
    const set = new Set<string>();
    const lines = buildDialogueLines({ scenes, preferField: "playMarkdown" });
    for (const l of lines) {
      if (l.kind !== "utterance") continue;
      if (!l.role) continue;
      const k = normalizeRoleKey(l.role);
      if (k) set.add(k);
    }
    return set;
  }, [scenes]);

  const rolesForActor = useMemo(() => {
    const me = normalizeActorKey(myEmail);
    const list = Array.isArray(projectRoles) ? projectRoles : [];
    if (canPickAnyRole) return list;

    const assigned = list.filter((r) =>
      (r?.emails ?? []).some((em) => normalizeActorKey(em) === me),
    );
    if (assigned.length > 0) return assigned;

    const mentioned = list.filter((r) => {
      const keys = [
        normalizeRoleKey(r?.key ?? ""),
        normalizeRoleKey(r?.title ?? ""),
        ...((r?.aliases ?? []) as string[]).map((a) =>
          normalizeRoleKey(String(a ?? "")),
        ),
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!roleStorageKey) return;
    if (rolesForActor.length === 0) return;
    const stored = String(localStorage.getItem(roleStorageKey) ?? "").trim();
    if (stored && rolesForActor.some((r) => String(r.id) === stored) && roleId !== stored) {
      setRoleId(stored);
      return;
    }
    if (!roleId || !rolesForActor.some((r) => String(r.id) === roleId)) {
      const first = rolesForActor[0]?.id;
      if (first != null) setRoleId(String(first));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleStorageKey, rolesForActor]);

  const effectiveRoleInfo = useMemo(() => {
    const wanted = roleId
      ? rolesForActor.find((r) => String(r.id) === String(roleId))
      : null;
    return wanted || rolesForActor[0] || null;
  }, [roleId, rolesForActor]);

  const effectiveRoleTitle = useMemo(
    () => String(effectiveRoleInfo?.title ?? ""),
    [effectiveRoleInfo?.title],
  );

  const effectiveRoleKeys = useMemo(() => {
    if (!effectiveRoleInfo) return [];
    const out: string[] = [];
    if (effectiveRoleInfo.key) out.push(normalizeRoleKey(effectiveRoleInfo.key));
    if (effectiveRoleInfo.title) out.push(normalizeRoleKey(effectiveRoleInfo.title));
    for (const a of effectiveRoleInfo.aliases ?? []) {
      if (!a) continue;
      out.push(normalizeRoleKey(a));
    }
    return Array.from(new Set(out.filter(Boolean)));
  }, [effectiveRoleInfo]);

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
    return extractRolePhrasesFromScenes({
      scenes,
      role: effectiveRoleTitle || effectiveRoleInfo.key || "",
      roleKeys: effectiveRoleKeys,
      preferField: "playMarkdown",
    });
  }, [effectiveRoleInfo, effectiveRoleKeys, effectiveRoleTitle, scenes]);

  const phraseScenes = useMemo(() => {
    const map = new Map<number, { sceneId: number; sceneTitle: string; count: number }>();
    for (const p of phrases) {
      const prev = map.get(p.sceneId);
      if (prev) map.set(p.sceneId, { ...prev, count: prev.count + 1 });
      else map.set(p.sceneId, { sceneId: p.sceneId, sceneTitle: p.sceneTitle, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => a.sceneId - b.sceneId);
  }, [phrases]);

  useEffect(() => {
    if (!accessToken || !projectName) return;
    if (scenes.length > 0) return;
    void syncFromServer(accessToken, projectName);
  }, [accessToken, projectName, scenes.length, syncFromServer]);

  const phraseScenesEmptyHint = useMemo(() => {
    if (phraseScenes.length > 0) return null;
    if (!effectiveRoleInfo) {
      return myEmail
        ? "Выберите роль или проверьте назначение роли в карточке готовности."
        : "Дождитесь загрузки профиля.";
    }
    if (scenes.length === 0) {
      return isPlaybookReady
        ? "В проекте нет сцен сценария или поле «Текст» пустое."
        : "Загрузка сценария… Если список не появится, откройте проект на главной странице.";
    }

    const rolesWithPhrases = rolesForActor
      .map((r) => {
        const keys = [
          normalizeRoleKey(String(r.key ?? "")),
          normalizeRoleKey(String(r.title ?? "")),
          ...((r.aliases ?? []) as string[]).map((a) => normalizeRoleKey(String(a ?? ""))),
        ].filter(Boolean);
        const count = extractRolePhrasesFromScenes({
          scenes,
          role: String(r.title ?? r.key ?? ""),
          roleKeys: keys,
          preferField: "playMarkdown",
        }).length;
        return { title: String(r.title ?? r.key ?? r.id), count };
      })
      .filter((x) => x.count > 0);

    if (rolesWithPhrases.length > 0) {
      return `У роли «${effectiveRoleTitle}» нет реплик в «Тексте». Реплики есть у: ${rolesWithPhrases
        .map((x) => x.title)
        .join(", ")} — выберите другую роль выше.`;
    }

    return `Для роли «${effectiveRoleTitle}» реплики не найдены. Проверьте разметку [[РОЛЬ]] или РОЛЬ: … в поле «Текст» сцен.`;
  }, [
    effectiveRoleInfo,
    effectiveRoleTitle,
    isPlaybookReady,
    myEmail,
    phraseScenes.length,
    rolesForActor,
    scenes,
  ]);

  const phrasesByScene = useMemo(() => {
    const map = new Map<number, RolePhraseSource[]>();
    for (const p of phrases) {
      const arr = map.get(p.sceneId);
      if (arr) arr.push(p);
      else map.set(p.sceneId, [p]);
    }
    return map;
  }, [phrases]);

  const [selectedPlaybookIds, setSelectedSceneIds] = useState<number[] | "all">("all");

  const phraseSceneIdSet = useMemo(
    () => new Set(phraseScenes.map((s) => s.sceneId)),
    [phraseScenes],
  );

  const normalizedSelectedSceneIds = useMemo(() => {
    if (selectedPlaybookIds === "all") return "all" as const;
    const uniq = Array.from(new Set(selectedPlaybookIds)).filter((id) =>
      phraseSceneIdSet.has(id),
    );
    return uniq;
  }, [phraseSceneIdSet, selectedPlaybookIds]);

  const filteredPhrases = useMemo(() => {
    if (normalizedSelectedSceneIds === "all") return phrases;
    if (normalizedSelectedSceneIds.length === 0) return [];
    const allowed = new Set(normalizedSelectedSceneIds);
    return phrases.filter((p) => allowed.has(p.sceneId));
  }, [phrases, normalizedSelectedSceneIds]);

  const totalInAllScenes = useMemo(
    () => phraseScenes.reduce((acc, s) => acc + s.count, 0),
    [phraseScenes],
  );

  const trainerStorageKey = useMemo(() => {
    const roleKey = effectiveRoleInfo?.key
      ? normalizeRoleKeyForStorage(effectiveRoleInfo.key)
      : "";
    if (!projectName || !myEmail || !roleKey) return "";
    return [
      "actorTrainer",
      "phraseWrite",
      projectName,
      normalizeActorKey(myEmail),
      roleKey,
    ].join(":");
  }, [effectiveRoleInfo?.key, myEmail, projectName]);

  const dialogueStorageKey = useMemo(() => {
    const roleKey = effectiveRoleInfo?.key
      ? normalizeRoleKeyForStorage(effectiveRoleInfo.key)
      : "";
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
    const roleKey = effectiveRoleInfo?.key
      ? normalizeRoleKeyForStorage(effectiveRoleInfo.key)
      : "";
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
    setSelectedSceneIds("all");
  }, [effectiveRoleInfo?.id, projectName]);

  const actorUiKey = useMemo(() => {
    const roleKey = effectiveRoleInfo?.key
      ? normalizeRoleKeyForStorage(effectiveRoleInfo.key)
      : "";
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
  const [trainerModeFallback, setTrainerModeFallback] =
    useState<ActorTrainerMode>("dialogue");
  const trainerMode: ActorTrainerMode = actorUiKey
    ? trainerModeFromStore
    : trainerModeFallback;

  const setTrainerMode = (mode: ActorTrainerMode) => {
    if (!actorUiKey) {
      setTrainerModeFallback(mode);
      return;
    }
    dispatch(actorTrainerUiActions.setTrainerMode({ uiKey: actorUiKey, value: mode }));
  };

  const selectedPlaybookIdsForTraining = useMemo(() => {
    if (normalizedSelectedSceneIds === "all") {
      return phraseScenes.map((s) => s.sceneId);
    }
    return normalizedSelectedSceneIds;
  }, [normalizedSelectedSceneIds, phraseScenes]);

  const scenesLabel = useMemo(() => {
    if (!effectiveRoleInfo) return "—";
    if (normalizedSelectedSceneIds === "all") return `все (${phraseScenes.length})`;
    return `${normalizedSelectedSceneIds.length} / ${phraseScenes.length}`;
  }, [effectiveRoleInfo, normalizedSelectedSceneIds, phraseScenes.length]);

  const openSceneInScript = useCallback(
    (sceneId: number) => {
      if (!projectName) return;
      localStorage.setItem(`selectedSceneId:${projectName}`, String(sceneId));
      navigate("/");
    },
    [navigate, projectName],
  );

  return {
    projects,
    projectItems,
    projectName,
    currentProjectDisplayName,
    onProjectChange,
    scenes,
    settingsHidden,
    setSettingsHidden,
    profileLoading,
    myEmail,
    canPickAnyRole,
    rolesLoading,
    rolesForActor,
    rolesError,
    roleId,
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
    scenesLabel,
    trainerStorageKey,
    dialogueStorageKey,
    voiceStorageKey,
    openSceneInScript,
  };
}
