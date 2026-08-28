import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DirectorRehearsalSession,
  DirectorSessionSlot,
} from "../directorSessionsSync";
import {
  packedOffsetsForOrder,
  suggestIdleMinimizingSlotOrder,
  type IdleOrderSuggestion,
} from "./session-slot-idle-order";
import {
  classifyActorSlotAvailability,
  durationMinFromParts,
  durationPartsFromMin,
  formatSlotTime,
  getSessionStartLocalMinutes,
  normalizeEmail,
  parseTimeHHMM,
} from "./session-page-utils";
import type { TeamProfile } from "../../../sync/api/profile";
import { createId } from "../../../shared/utils/createId";
import {
  type DragSceneRefPayload,
  guessDurationMin,
  packSlotsSequentialInOrder,
  parseDragSceneRef,
  parseDragSlotId,
} from "./director-session-slots-dnd";

export type DirectorSessionSlotDisplay = {
  projectLabel: string;
  materialLabel: string;
  isProgRun?: boolean;
};

export type DirectorSessionSlotsPanelProps = {
  session: DirectorRehearsalSession;
  sessions: DirectorRehearsalSession[];
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
  /** Если удалили последний выбранный слот и слотов не осталось */
  onNoSlotsLeft?: () => void;
  persistSessions: (next: DirectorRehearsalSession[]) => Promise<boolean | void>;
  busyConflictError?: string | null;
  onDismissBusyConflictError?: () => void;
  /** Блок настроек слота (проект, сцена, превью, заметки) — в модалке по выбранному слоту */
  slotSettings?: React.ReactNode;
  onRequestCloseSlot: () => void;
  /** Доп. класс на карточке слота (напр. доступность по ролям на странице одной сессии) */
  slotToneClassById?: Map<string, string> | null;
  slotDisplayById?: Map<string, DirectorSessionSlotDisplay> | null;
  /** Emails актёров по слоту (для упорядочивания без простоя) */
  emailsBySlotId?: Record<string, string[]> | null;
  profilesByEmail?: Map<string, TeamProfile> | null;
  sessionDateKey?: string | null;
};

export type SlotDraftEntry = {
  time: string;
  durationHours: string;
  durationMinutes: string;
};

export type IdleOrderPreviewItem = {
  id: string;
  index: number;
  timeLabel: string;
  sceneTitle: string;
  projectTitle: string;
  durationMin: number;
};

export type DirectorSessionSlotsPanelViewModel = ReturnType<
  typeof useDirectorSessionSlotsPanel
>;

export function useDirectorSessionSlotsPanel({
  session,
  sessions,
  selectedSlotId,
  onSelectSlot,
  onNoSlotsLeft,
  persistSessions,
  busyConflictError = null,
  onDismissBusyConflictError,
  slotSettings,
  onRequestCloseSlot,
  slotToneClassById,
  slotDisplayById,
  emailsBySlotId = null,
  profilesByEmail = null,
  sessionDateKey = null,
}: DirectorSessionSlotsPanelProps) {
  const [autoShiftFollowing] = useState(true);
  const [timelineDragOver, setTimelineDragOver] = useState(false);
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [touchDragOverSlotId, setTouchDragOverSlotId] = useState<string | null>(
    null,
  );
  const [isTouchDraggingSlot, setIsTouchDraggingSlot] = useState(false);
  const touchDragPointerIdRef = useRef<number | null>(null);
  const touchDragOverSlotIdRef = useRef<string | null>(null);
  const touchDragPreviewRef = useRef<HTMLDivElement | null>(null);
  const touchDragPointRef = useRef<{ x: number; y: number } | null>(null);
  const [materialDragPayload, setMaterialDragPayload] =
    useState<DragSceneRefPayload | null>(null);
  const [idleOrderPreview, setIdleOrderPreview] =
    useState<IdleOrderSuggestion | null>(null);
  const [idleOrderBusyEmails, setIdleOrderBusyEmails] = useState<string[]>([]);

  const [slotDraft, setSlotDraft] = useState<Record<string, SlotDraftEntry>>(
    {},
  );

  const mergeSession = useCallback(
    (nextSession: DirectorRehearsalSession) =>
      sessions.map((s) => (s.id === nextSession.id ? nextSession : s)),
    [sessions],
  );

  const updateActiveSession = useCallback(
    async (patch: Partial<DirectorRehearsalSession>) => {
      const nowIso = new Date().toISOString();
      const nextSession: DirectorRehearsalSession = {
        ...session,
        ...patch,
        updatedAt: nowIso,
      };
      const saved = await persistSessions(mergeSession(nextSession));
      return saved !== false;
    },
    [mergeSession, persistSessions, session],
  );

  const updateSlot = useCallback(
    async (
      slotId: string,
      patch: Partial<DirectorSessionSlot>,
      options?: { shiftFollowing?: boolean; deltaMin?: number },
    ) => {
      const shiftFollowing = Boolean(options?.shiftFollowing);
      const deltaMin = options?.deltaMin ?? 0;
      const baseSlots = [...(session.slots ?? [])];
      const current = baseSlots.find((s) => s.id === slotId) ?? null;
      if (!current) return;
      const currentOffset = current.offsetMin;
      const nextSlots = baseSlots.map((s) => {
        if (s.id === slotId) return { ...s, ...patch };
        if (shiftFollowing && deltaMin !== 0 && s.offsetMin > currentOffset) {
          return {
            ...s,
            offsetMin: Math.max(0, Math.floor(s.offsetMin + deltaMin)),
          };
        }
        return s;
      });
      await updateActiveSession({ slots: nextSlots });
    },
    [session.slots, updateActiveSession],
  );

  const addSlot = async () => {
    const last = [...(session.slots ?? [])]
      .sort((a, b) => a.offsetMin - b.offsetMin)
      .slice(-1)[0];
    const nextOffset = last
      ? last.offsetMin + Math.max(1, last.durationMin)
      : 0;
    const slot: DirectorSessionSlot = {
      id: createId(),
      offsetMin: nextOffset,
      durationMin: 30,
    };
    const saved = await updateActiveSession({
      slots: [...(session.slots ?? []), slot],
    });
    if (saved) onSelectSlot(slot.id);
  };

  const removeSlot = async (slotId: string) => {
    const nextSlots = (session.slots ?? []).filter((x) => x.id !== slotId);
    await updateActiveSession({ slots: nextSlots });
    if (selectedSlotId === slotId) {
      const first = nextSlots[0]?.id;
      if (first) onSelectSlot(first);
      else onNoSlotsLeft?.();
    }
  };

  const slotsWithScenes = useMemo(() => {
    return (session.slots ?? []).filter(
      (sl) =>
        Boolean(String(sl.ref?.projectSlug ?? "").trim()) &&
        sl.ref?.sceneId != null,
    );
  }, [session.slots]);

  const canSuggestIdleOrder = slotsWithScenes.length >= 2;

  const openIdleOrderPreview = () => {
    if (!canSuggestIdleOrder) return;
    const currentOrder = [...slotsWithScenes]
      .sort((a, b) => a.offsetMin - b.offsetMin)
      .map((s) => s.id);
    const actorsBySlotId: Record<string, string[]> = {};
    const durationBySlotId: Record<string, number> = {};
    for (const sl of slotsWithScenes) {
      actorsBySlotId[sl.id] = (emailsBySlotId?.[sl.id] ?? []).map((e) =>
        normalizeEmail(e),
      );
      durationBySlotId[sl.id] = Math.max(
        1,
        Math.floor(Number(sl.durationMin) || 1),
      );
    }
    const suggestion = suggestIdleMinimizingSlotOrder(
      currentOrder,
      actorsBySlotId,
      durationBySlotId,
    );
    if (!suggestion) return;

    const offsets = packedOffsetsForOrder(
      suggestion.order,
      durationBySlotId,
    );
    const sessionBase = getSessionStartLocalMinutes(session.startsAt);
    const busy = new Set<string>();
    if (sessionDateKey && profilesByEmail) {
      for (const id of suggestion.order) {
        const startMin =
          sessionBase + Math.max(0, Math.floor(offsets[id] ?? 0));
        const endMin = startMin + durationBySlotId[id]!;
        for (const email of actorsBySlotId[id] ?? []) {
          const prof = profilesByEmail.get(email);
          if (
            classifyActorSlotAvailability(
              prof,
              sessionDateKey,
              startMin,
              endMin,
            ) === "busy"
          ) {
            busy.add(email);
          }
        }
      }
    }
    setIdleOrderBusyEmails(Array.from(busy).sort());
    setIdleOrderPreview(suggestion);
  };

  const closeIdleOrderPreview = () => {
    setIdleOrderPreview(null);
    setIdleOrderBusyEmails([]);
  };

  const applyIdleOrderPreview = async () => {
    if (!idleOrderPreview) return;
    const byId = new Map((session.slots ?? []).map((s) => [s.id, s]));
    const orderedWithScenes: DirectorSessionSlot[] = [];
    for (const id of idleOrderPreview.order) {
      const sl = byId.get(id);
      if (sl) orderedWithScenes.push(sl);
    }
    const rest = (session.slots ?? []).filter(
      (sl) => !idleOrderPreview.order.includes(sl.id),
    );
    const nextSlots = packSlotsSequentialInOrder([
      ...orderedWithScenes,
      ...rest.sort((a, b) => a.offsetMin - b.offsetMin),
    ]);
    closeIdleOrderPreview();
    await updateActiveSession({ slots: nextSlots });
  };

  const moveSlotToTarget = useCallback(
    async (dragId: string, targetId: string) => {
      if (dragId === targetId) return;
      const sorted = [...(session.slots ?? [])].sort(
        (a, b) => a.offsetMin - b.offsetMin,
      );
      const fromIndex = sorted.findIndex((s) => s.id === dragId);
      const toIndex = sorted.findIndex((s) => s.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return;

      const insertAfter = fromIndex < toIndex;
      const next = [...sorted];
      const [moved] = next.splice(fromIndex, 1);
      const targetIndexAfterRemoval = next.findIndex((s) => s.id === targetId);
      if (targetIndexAfterRemoval === -1) return;
      const insertAt = insertAfter
        ? targetIndexAfterRemoval + 1
        : targetIndexAfterRemoval;
      next.splice(insertAt, 0, moved);
      await updateActiveSession({ slots: packSlotsSequentialInOrder(next) });
    },
    [session.slots, updateActiveSession],
  );

  const attachSceneToSlotByDrop = async (
    slotId: string,
    payload: DragSceneRefPayload,
  ) => {
    const slots = [...(session.slots ?? [])];
    const current = slots.find((s) => s.id === slotId) ?? null;
    if (!current) return;
    const nextDur = guessDurationMin(payload);
    const prevDur = Math.max(1, Math.floor(Number(current.durationMin) || 1));
    const delta = nextDur - prevDur;
    await updateSlot(
      slotId,
      {
        ref: { projectSlug: payload.projectSlug, sceneId: payload.sceneId },
        durationMin: nextDur,
      },
      { shiftFollowing: autoShiftFollowing, deltaMin: delta },
    );
    onSelectSlot(slotId);
    const parts = durationPartsFromMin(nextDur);
    setSlotDraft((p) => ({
      ...p,
      [slotId]: {
        ...(p[slotId] ?? {
          time: formatSlotTime(session.startsAt, current.offsetMin),
          durationHours: "0",
          durationMinutes: "30",
        }),
        durationHours: String(parts.hours),
        durationMinutes: String(parts.minutes),
      },
    }));
  };

  const addSlotFromDroppedScene = async (payload: DragSceneRefPayload) => {
    const sorted = [...(session.slots ?? [])].sort(
      (a, b) => a.offsetMin - b.offsetMin,
    );
    const last = sorted.slice(-1)[0] ?? null;
    const offsetMin = last
      ? last.offsetMin + Math.max(1, Math.floor(Number(last.durationMin) || 1))
      : 0;
    const durationMin = guessDurationMin(payload);
    const slot: DirectorSessionSlot = {
      id: createId(),
      offsetMin,
      durationMin,
      ref: { projectSlug: payload.projectSlug, sceneId: payload.sceneId },
    };
    const saved = await updateActiveSession({
      slots: [...(session.slots ?? []), slot],
    });
    if (saved) onSelectSlot(slot.id);
  };

  useEffect(() => {
    setSlotDraft((prev) => {
      const next = { ...prev };
      for (const sl of session.slots ?? []) {
        if (!next[sl.id]) {
          const parts = durationPartsFromMin(sl.durationMin ?? 30);
          next[sl.id] = {
            time: formatSlotTime(session.startsAt, sl.offsetMin),
            durationHours: String(parts.hours),
            durationMinutes: String(parts.minutes),
          };
        }
      }
      Object.keys(next).forEach((id) => {
        if (!(session.slots ?? []).some((s) => s.id === id)) delete next[id];
      });
      return next;
    });
  }, [session.id, session.startsAt, session.slots]);

  const commitSlotDraft = async (slotId: string) => {
    const d = slotDraft[slotId];
    const sl = (session.slots ?? []).find((s) => s.id === slotId);
    if (!d || !sl) return;
    const base = getSessionStartLocalMinutes(session.startsAt);
    const abs = parseTimeHHMM(d.time);
    const durNum = durationMinFromParts(d.durationHours, d.durationMinutes);
    const nextOffset =
      abs == null ? sl.offsetMin : Math.max(0, Math.floor(abs - base));
    const prevDur = Math.max(1, Math.floor(sl.durationMin || 1));
    const delta = durNum - prevDur;
    const parts = durationPartsFromMin(durNum);
    setSlotDraft((p) => ({
      ...p,
      [slotId]: {
        ...d,
        durationHours: String(parts.hours),
        durationMinutes: String(parts.minutes),
      },
    }));
    await updateSlot(
      slotId,
      { offsetMin: nextOffset, durationMin: durNum },
      { shiftFollowing: autoShiftFollowing, deltaMin: delta },
    );
  };

  const sortedSlots = useMemo(
    () =>
      [...(session.slots ?? [])].sort((a, b) => a.offsetMin - b.offsetMin),
    [session.slots],
  );

  const selectedSlotForModal = useMemo(() => {
    if (!selectedSlotId) return null;
    return sortedSlots.find((s) => s.id === selectedSlotId) ?? null;
  }, [sortedSlots, selectedSlotId]);

  const draggedSlotForTouchPreview = useMemo(() => {
    if (!isTouchDraggingSlot || !draggedSlotId) return null;
    return sortedSlots.find((s) => s.id === draggedSlotId) ?? null;
  }, [draggedSlotId, isTouchDraggingSlot, sortedSlots]);

  const getSlotDisplay = useCallback(
    (sl: DirectorSessionSlot): DirectorSessionSlotDisplay => {
      const display = slotDisplayById?.get(sl.id);
      if (display) return display;
      if (sl.isProgRun) {
        return {
          projectLabel: "ПРОГОН",
          materialLabel: String(sl.ref?.projectSlug ?? "").trim() || "Проект",
          isProgRun: true,
        };
      }
      const customTitle = String(sl.title ?? "").trim();
      if (!sl.ref) {
        return {
          projectLabel: customTitle || "Слот без названия",
          materialLabel: "Без проекта",
        };
      }
      return {
        projectLabel:
          customTitle || String(sl.ref.projectSlug ?? "").trim() || "Проект",
        materialLabel: String(sl.ref.projectSlug ?? "").trim() || "Проект",
      };
    },
    [slotDisplayById],
  );

  const draggedSlotDisplay = useMemo(
    () =>
      draggedSlotForTouchPreview
        ? getSlotDisplay(draggedSlotForTouchPreview)
        : null,
    [draggedSlotForTouchPreview, getSlotDisplay],
  );

  const idleOrderPreviewItems = useMemo((): IdleOrderPreviewItem[] => {
    if (!idleOrderPreview) return [];
    const durationBySlotId: Record<string, number> = {};
    for (const item of slotsWithScenes) {
      durationBySlotId[item.id] = Math.max(
        1,
        Math.floor(Number(item.durationMin) || 1),
      );
    }
    const offsets = packedOffsetsForOrder(
      idleOrderPreview.order,
      durationBySlotId,
    );
    const items: IdleOrderPreviewItem[] = [];
    idleOrderPreview.order.forEach((id, index) => {
      const sl = (session.slots ?? []).find((s) => s.id === id);
      if (!sl) return;
      const display = getSlotDisplay(sl);
      items.push({
        id,
        index,
        timeLabel: formatSlotTime(session.startsAt, offsets[id] ?? 0),
        sceneTitle: display.projectLabel,
        projectTitle: display.materialLabel,
        durationMin: durationBySlotId[id] ?? sl.durationMin,
      });
    });
    return items;
  }, [
    getSlotDisplay,
    idleOrderPreview,
    session.slots,
    session.startsAt,
    slotsWithScenes,
  ]);

  const updateTouchDragPreview = useCallback(
    (clientX: number, clientY: number) => {
      touchDragPointRef.current = { x: clientX, y: clientY };
      const preview = touchDragPreviewRef.current;
      if (!preview) return;
      const x = Math.round(clientX + 12);
      const y = Math.round(clientY + 12);
      preview.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    },
    [],
  );

  useEffect(() => {
    const point = touchDragPointRef.current;
    if (!draggedSlotForTouchPreview || !point) return;
    updateTouchDragPreview(point.x, point.y);
  }, [draggedSlotForTouchPreview, updateTouchDragPreview]);

  useEffect(() => {
    if (!draggedSlotId || touchDragPointerIdRef.current == null) return;

    const getSlotIdAtPoint = (clientX: number, clientY: number) => {
      const target = document.elementFromPoint(clientX, clientY);
      const row = target?.closest<HTMLElement>("[data-session-slot-id]");
      return row?.dataset.sessionSlotId ?? null;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== touchDragPointerIdRef.current) return;
      e.preventDefault();
      updateTouchDragPreview(e.clientX, e.clientY);
      const nextSlotId = getSlotIdAtPoint(e.clientX, e.clientY);
      const nextOverSlotId =
        nextSlotId && nextSlotId !== draggedSlotId ? nextSlotId : null;
      touchDragOverSlotIdRef.current = nextOverSlotId;
      setTouchDragOverSlotId(nextOverSlotId);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId !== touchDragPointerIdRef.current) return;
      e.preventDefault();
      const nextSlotId =
        touchDragOverSlotIdRef.current ?? getSlotIdAtPoint(e.clientX, e.clientY);
      touchDragPointerIdRef.current = null;
      touchDragOverSlotIdRef.current = null;
      touchDragPointRef.current = null;
      setTouchDragOverSlotId(null);
      setDraggedSlotId(null);
      setIsTouchDraggingSlot(false);
      if (nextSlotId && nextSlotId !== draggedSlotId) {
        void moveSlotToTarget(draggedSlotId, nextSlotId);
      }
    };

    const handlePointerCancel = (e: PointerEvent) => {
      if (e.pointerId !== touchDragPointerIdRef.current) return;
      touchDragPointerIdRef.current = null;
      touchDragOverSlotIdRef.current = null;
      touchDragPointRef.current = null;
      setTouchDragOverSlotId(null);
      setDraggedSlotId(null);
      setIsTouchDraggingSlot(false);
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handlePointerUp, { passive: false });
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [draggedSlotId, moveSlotToTarget, updateTouchDragPreview]);

  const beginTouchSlotDrag = (
    slotId: string,
    e: React.PointerEvent<HTMLElement>,
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    touchDragPointerIdRef.current = e.pointerId;
    touchDragOverSlotIdRef.current = null;
    updateTouchDragPreview(e.clientX, e.clientY);
    setDraggedSlotId(slotId);
    setTouchDragOverSlotId(null);
    setIsTouchDraggingSlot(true);
  };

  const handleTimelineDragEnter = () => {
    if (materialDragPayload) setTimelineDragOver(true);
  };

  const handleTimelineDragLeave = () => setTimelineDragOver(false);

  const handleTimelineDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!materialDragPayload) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleTimelineDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const payload = parseDragSceneRef(e.dataTransfer) ?? materialDragPayload;
    setTimelineDragOver(false);
    setMaterialDragPayload(null);
    if (!payload) return;
    e.preventDefault();
    void addSlotFromDroppedScene(payload);
  };

  const handleSlotRowDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (materialDragPayload) e.dataTransfer.dropEffect = "copy";
    else e.dataTransfer.dropEffect = "move";
  };

  const handleSlotRowDrop = (
    slotId: string,
    e: React.DragEvent<HTMLDivElement>,
  ) => {
    e.preventDefault();
    const payload = parseDragSceneRef(e.dataTransfer) ?? materialDragPayload;
    if (payload) {
      setMaterialDragPayload(null);
      void attachSceneToSlotByDrop(slotId, payload);
      return;
    }
    const dragId = parseDragSlotId(e.dataTransfer) || draggedSlotId;
    if (!dragId) return;
    void moveSlotToTarget(dragId, slotId);
  };

  const patchSlotDraft = (
    slotId: string,
    patch: Partial<SlotDraftEntry>,
  ) => {
    setSlotDraft((p) => ({
      ...p,
      [slotId]: {
        ...(p[slotId] ?? {
          time: "",
          durationHours: "0",
          durationMinutes: "30",
        }),
        ...patch,
      },
    }));
  };

  const draggedSlotIndex = draggedSlotId
    ? sortedSlots.findIndex((slot) => slot.id === draggedSlotId)
    : -1;

  return {
    session,
    selectedSlotId,
    busyConflictError,
    onDismissBusyConflictError,
    slotSettings,
    onRequestCloseSlot,
    slotToneClassById,
    timelineDragOver,
    draggedSlotId,
    touchDragOverSlotId,
    draggedSlotIndex,
    touchDragPreviewRef,
    materialDragPayload,
    idleOrderPreview,
    idleOrderBusyEmails,
    idleOrderPreviewItems,
    slotDraft,
    sortedSlots,
    selectedSlotForModal,
    draggedSlotForTouchPreview,
    draggedSlotDisplay,
    canSuggestIdleOrder,
    getSlotDisplay,
    formatSlotTime: (offsetMin: number) =>
      formatSlotTime(session.startsAt, offsetMin),
    addSlot,
    removeSlot,
    openIdleOrderPreview,
    closeIdleOrderPreview,
    applyIdleOrderPreview,
    commitSlotDraft,
    patchSlotDraft,
    beginTouchSlotDrag,
    handleTimelineDragEnter,
    handleTimelineDragLeave,
    handleTimelineDragOver,
    handleTimelineDrop,
    handleSlotRowDragOver,
    handleSlotRowDrop,
    onSelectSlot,
  };
}
