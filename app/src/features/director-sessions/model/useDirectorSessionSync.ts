import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
import { useCallback, useEffect, useState } from "react";
import type {
  DirectorRehearsalSession,
  DirectorSessionSlot,
} from "../directorSessionsSync";
import {
  useDirectorSessionsBundleQuery,
  useReplaceDirectorSessionsMutation,
} from "../api/director-sessions-api";
import {
  findBusyConflictForChangedSessions,
  formatDirectorSessionBusyConflictMessage,
} from "./session-page-utils";

export function useDirectorSessionSync(args: {
  accessToken: string | null | undefined;
  sid: string;
  slId: string;
}) {
  const { accessToken, sid, slId } = args;

  const [sessions, setSessions] = useState<DirectorRehearsalSession[]>([]);
  const [session, setSession] = useState<DirectorRehearsalSession | null>(null);
  const [slot, setSlot] = useState<DirectorSessionSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyConflictError, setBusyConflictError] = useState<string | null>(
    null,
  );

  const {
    data: sessionsBundle,
    isLoading: bundleLoading,
    error: bundleQueryError,
    refetch: refetchSessionsBundle,
  } = useDirectorSessionsBundleQuery(undefined, {
    skip: !accessToken || !sid,
  });
  const [replaceSessions] = useReplaceDirectorSessionsMutation();

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
    setError(null);
  }, [accessToken, sid, sessionsBundle, bundleLoading, bundleQueryError]);

  useEffect(() => {
    if (!session) {
      setSlot(null);
      return;
    }
    if (!slId) {
      setSlot(null);
      setError(null);
      return;
    }
    const sl = session.slots.find((item) => item.id === slId) ?? null;
    setSlot(sl);
    if (!sl) {
      const n = session.slots.length;
      setError(
        n === 0
          ? "Слотов пока нет — добавь первый в блоке «Слоты» слева."
          : null,
      );
    } else {
      setError(null);
    }
  }, [session, slId]);

  const persistSessions = async (
    next: DirectorRehearsalSession[],
  ): Promise<boolean> => {
    if (!accessToken) return false;
    const busyConflict = findBusyConflictForChangedSessions(sessions, next);
    if (busyConflict) {
      setBusyConflictError(
        formatDirectorSessionBusyConflictMessage(busyConflict),
      );
      return false;
    }
    const previousSessions = sessions;
    const previousSession = session;
    const previousSlot = slot;
    const nextSession = next.find((item) => item.id === sid) ?? null;
    const nextSlot =
      nextSession && slId
        ? nextSession.slots.find((item) => item.id === slId) ?? null
        : null;

    setSessions(next);
    setSession(nextSession);
    setSlot(nextSlot);
    setBusyConflictError(null);
    setError(null);
    try {
      await replaceSessions({ sessions: next }).unwrap();
      void refetchSessionsBundle();
      return true;
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

  const dismissBusyConflictError = () => setBusyConflictError(null);

  return {
    sessions,
    session,
    slot,
    error,
    loading: bundleLoading,
    busyConflictError,
    setBusyConflictError,
    dismissBusyConflictError,
    persistSessions,
    updateSlot,
    updateSlotById,
    slotNotesDraft,
    onSlotNotesChange,
    onSlotNotesBlur,
  };
}
