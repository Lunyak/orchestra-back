import { useCallback, useEffect, useRef, useState } from "react";
import type { AppDispatch } from "../../../shared/store/store";
import {
  saveDirectorRefsThunk,
  saveRoleWorkbookThunk,
} from "./roleWorkbookSlice";
import { ACTOR_WORKBOOK_AUTOSAVE_DELAY_MS } from "./role-workbook-sections";

type UseRoleWorkbookAutosaveArgs = {
  dispatch: AppDispatch;
  accessToken: string | null;
  projectSlug: string | undefined;
  effectiveRoleId: string;
  selectedActor: string;
  canEdit: boolean;
  canEditDirectorRefs: boolean;
};

export function useRoleWorkbookAutosave(args: UseRoleWorkbookAutosaveArgs) {
  const {
    dispatch,
    accessToken,
    projectSlug,
    effectiveRoleId,
    selectedActor,
    canEdit,
    canEditDirectorRefs,
  } = args;

  const [actorDraftDirtyRevision, setActorDraftDirtyRevision] = useState(0);
  const actorDraftDirtyRevisionRef = useRef(0);
  const actorDraftSavedRevisionRef = useRef(0);
  const actorDraftAutosaveTimerRef = useRef<number | null>(null);
  const [directorRefsDirtyRevision, setDirectorRefsDirtyRevision] = useState(0);
  const directorRefsDirtyRevisionRef = useRef(0);
  const directorRefsSavedRevisionRef = useRef(0);
  const directorRefsAutosaveTimerRef = useRef<number | null>(null);

  const clearActorAutosaveTimer = useCallback(() => {
    const timer = actorDraftAutosaveTimerRef.current;
    if (timer == null) return;
    window.clearTimeout(timer);
    actorDraftAutosaveTimerRef.current = null;
  }, []);

  const clearDirectorRefsAutosaveTimer = useCallback(() => {
    const timer = directorRefsAutosaveTimerRef.current;
    if (timer == null) return;
    window.clearTimeout(timer);
    directorRefsAutosaveTimerRef.current = null;
  }, []);

  const markActorDraftDirty = useCallback(() => {
    if (!canEdit) return;
    const nextRevision = actorDraftDirtyRevisionRef.current + 1;
    actorDraftDirtyRevisionRef.current = nextRevision;
    setActorDraftDirtyRevision(nextRevision);
  }, [canEdit]);

  const markDirectorRefsDirty = useCallback(() => {
    if (!canEditDirectorRefs) return;
    const nextRevision = directorRefsDirtyRevisionRef.current + 1;
    directorRefsDirtyRevisionRef.current = nextRevision;
    setDirectorRefsDirtyRevision(nextRevision);
  }, [canEditDirectorRefs]);

  const saveActorDraftNow = useCallback(async () => {
    if (!canEdit || !accessToken || !projectSlug || !effectiveRoleId) return;
    const targetRevision = actorDraftDirtyRevisionRef.current;
    if (targetRevision <= actorDraftSavedRevisionRef.current) return;
    clearActorAutosaveTimer();
    await dispatch(saveRoleWorkbookThunk({ accessToken, projectSlug, roleId: effectiveRoleId }));
    actorDraftSavedRevisionRef.current = targetRevision;
  }, [
    accessToken,
    canEdit,
    clearActorAutosaveTimer,
    dispatch,
    effectiveRoleId,
    projectSlug,
  ]);

  const saveDirectorRefsNow = useCallback(async () => {
    if (!canEditDirectorRefs || !accessToken || !projectSlug || !effectiveRoleId) return;
    const targetRevision = directorRefsDirtyRevisionRef.current;
    if (targetRevision <= directorRefsSavedRevisionRef.current) return;
    clearDirectorRefsAutosaveTimer();
    await dispatch(saveDirectorRefsThunk({ accessToken, projectSlug, roleId: effectiveRoleId }));
    directorRefsSavedRevisionRef.current = targetRevision;
  }, [
    accessToken,
    canEditDirectorRefs,
    clearDirectorRefsAutosaveTimer,
    dispatch,
    effectiveRoleId,
    projectSlug,
  ]);

  useEffect(() => {
    clearActorAutosaveTimer();
    actorDraftDirtyRevisionRef.current = 0;
    actorDraftSavedRevisionRef.current = 0;
    setActorDraftDirtyRevision(0);
  }, [clearActorAutosaveTimer, effectiveRoleId, selectedActor]);

  useEffect(() => {
    clearDirectorRefsAutosaveTimer();
    directorRefsDirtyRevisionRef.current = 0;
    directorRefsSavedRevisionRef.current = 0;
    setDirectorRefsDirtyRevision(0);
  }, [clearDirectorRefsAutosaveTimer, effectiveRoleId]);

  useEffect(() => {
    if (!canEdit) return;
    if (actorDraftDirtyRevision <= actorDraftSavedRevisionRef.current) return;
    clearActorAutosaveTimer();
    actorDraftAutosaveTimerRef.current = window.setTimeout(() => {
      void saveActorDraftNow();
    }, ACTOR_WORKBOOK_AUTOSAVE_DELAY_MS);
    return clearActorAutosaveTimer;
  }, [actorDraftDirtyRevision, canEdit, clearActorAutosaveTimer, saveActorDraftNow]);

  useEffect(() => {
    if (!canEditDirectorRefs) return;
    if (directorRefsDirtyRevision <= directorRefsSavedRevisionRef.current) return;
    clearDirectorRefsAutosaveTimer();
    directorRefsAutosaveTimerRef.current = window.setTimeout(() => {
      void saveDirectorRefsNow();
    }, ACTOR_WORKBOOK_AUTOSAVE_DELAY_MS);
    return clearDirectorRefsAutosaveTimer;
  }, [
    canEditDirectorRefs,
    clearDirectorRefsAutosaveTimer,
    directorRefsDirtyRevision,
    saveDirectorRefsNow,
  ]);

  useEffect(() => {
    return () => {
      clearActorAutosaveTimer();
      clearDirectorRefsAutosaveTimer();
    };
  }, [clearActorAutosaveTimer, clearDirectorRefsAutosaveTimer]);

  return {
    markActorDraftDirty,
    markDirectorRefsDirty,
    saveActorDraftNow,
    saveDirectorRefsNow,
  };
}
