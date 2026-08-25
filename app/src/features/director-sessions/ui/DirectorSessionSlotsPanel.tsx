import { Buttons } from "@shared/components/buttons/Buttons";
import { ListItem } from "@shared/components/list-item/ListItem";
import { Button } from "@shared/core/button/Button";
import { Modal } from "@shared/core/modal/Modal";
import cn from "classnames";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import type {
  DirectorRehearsalSession,
  DirectorSessionSlot,
} from "../directorSessionsSync";
import {
  packedOffsetsForOrder,
  suggestIdleMinimizingSlotOrder,
  type IdleOrderSuggestion,
} from "../model/session-slot-idle-order";
import {
  classifyActorSlotAvailability,
  durationMinFromParts,
  durationPartsFromMin,
  normalizeEmail,
} from "../model/session-page-utils";
import type { TeamProfile } from "../../../sync/api/profile";
import { createId } from "../../../shared/utils/createId";
import "./director-sessions.css";

const DND_MIME_SLOT_ID = "application/x-orchestra-director-session-slot";
const DND_MIME_SCENE_REF = "application/x-orchestra-director-session-scene-ref";
const LEGACY_DND_MIME_STEP_REF = "application/x-orchestra-director-session-step-ref";

type DragSceneRefPayload = {
  kind: "sceneRef";
  projectSlug: string;
  sceneId: number;
  durationMin?: number;
};

type DirectorSessionSlotDisplay = {
  projectLabel: string;
  materialLabel: string;
  isProgRun?: boolean;
};

function parseDragSceneRef(dt: DataTransfer): DragSceneRefPayload | null {
  const raw =
    dt.getData(DND_MIME_SCENE_REF) || dt.getData(LEGACY_DND_MIME_STEP_REF);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<DragSceneRefPayload & { kind?: string }> | null;
    if (!v || (v.kind !== "sceneRef" && v.kind !== "stepRef")) return null;
    const projectSlug = String(v.projectSlug ?? "").trim();
    const sceneId = Number(v.sceneId);
    const durationMin =
      v.durationMin == null
        ? undefined
        : Math.max(1, Math.floor(Number(v.durationMin)));
    if (!projectSlug) return null;
    if (!Number.isFinite(sceneId) || sceneId <= 0) return null;
    return { kind: "sceneRef", projectSlug, sceneId, durationMin };
  } catch (_) {
    return null;
  }
}

function parseDragSlotId(dt: DataTransfer): string | null {
  const id = String(
    dt.getData(DND_MIME_SLOT_ID) || dt.getData("text/plain") || "",
  ).trim();
  return id || null;
}

function guessDurationMin(payload: DragSceneRefPayload): number {
  const d = Number(payload.durationMin);
  if (Number.isFinite(d) && d > 0) return Math.max(1, Math.floor(d));
  return 30;
}

function packSlotsSequentialInOrder(
  slots: DirectorSessionSlot[],
): DirectorSessionSlot[] {
  const list = [...(slots ?? [])];
  let offset = 0;
  return list.map((s) => {
    const dur = Math.max(1, Math.floor(Number(s.durationMin) || 1));
    const item = { ...s, offsetMin: offset, durationMin: dur };
    offset += dur;
    return item;
  });
}

function parseTimeHHMM(src: string): number | null {
  const s = String(src ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function formatTimeHHMM(totalMin: number): string {
  const m = ((Math.floor(totalMin) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getSessionStartLocalMinutes(startsAtIso: string): number {
  const d = new Date(startsAtIso);
  if (!Number.isFinite(d.getTime())) return 0;
  return d.getHours() * 60 + d.getMinutes();
}

function formatSlotTime(startsAtIso: string, offsetMin: number): string {
  const base = getSessionStartLocalMinutes(startsAtIso);
  return formatTimeHHMM(base + Math.max(0, Math.floor(offsetMin)));
}

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

export function DirectorSessionSlotsPanel({
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
  const [autoShiftFollowing, setAutoShiftFollowing] = useState(true);
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

  const [slotDraft, setSlotDraft] = useState<
    Record<
      string,
      { time: string; durationHours: string; durationMinutes: string }
    >
  >({});

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

  const packTimeline = async () => {
    const sorted = [...(session.slots ?? [])].sort(
      (a, b) => a.offsetMin - b.offsetMin,
    );
    await updateActiveSession({ slots: packSlotsSequentialInOrder(sorted) });
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
    setIdleOrderPreview(null);
    setIdleOrderBusyEmails([]);
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

  const updateTouchDragPreview = useCallback((clientX: number, clientY: number) => {
    touchDragPointRef.current = { x: clientX, y: clientY };
    const preview = touchDragPreviewRef.current;
    if (!preview) return;
    const x = Math.round(clientX + 12);
    const y = Math.round(clientY + 12);
    preview.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, []);

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

  return (
    <RehearsalsCard fluid title="" className="director-session-slots-panel">
      <div className="director-session-slots-panel__tools">
        {/* <Button type="button" onClick={() => void packTimeline()}>
          Выстроить подряд
        </Button> */}
        {/* <label className="sessions-check">
          <input
            type="checkbox"
            checked={autoShiftFollowing}
            onChange={(e) => setAutoShiftFollowing(e.target.checked)}
          />
          <span className="rehearsals-muted">сдвигать последующие при смене длительности</span>
        </label> */}
      </div>

      <div
        className={cn(
          "sessions-slots",
          "director-session-slots-panel__timeline",
          timelineDragOver && "sessions-slots--drop-active",
        )}
        onDragEnter={() => {
          if (materialDragPayload) setTimelineDragOver(true);
        }}
        onDragLeave={() => setTimelineDragOver(false)}
        onDragOver={(e) => {
          if (!materialDragPayload) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          const payload =
            parseDragSceneRef(e.dataTransfer) ?? materialDragPayload;
          setTimelineDragOver(false);
          setMaterialDragPayload(null);
          if (!payload) return;
          e.preventDefault();
          void addSlotFromDroppedScene(payload);
        }}
        title="Сюда можно перетащить картину или сцену — появится новый слот с материалом"
      >
        {sortedSlots.length === 0 && (
          <div className="sessions-slots-empty rehearsals-muted">
            Слотов нет — нажми «+» или перетащи картину/сцену сюда.
          </div>
        )}
        {sortedSlots.map((sl) => {
          const display = getSlotDisplay(sl);
          const slotTime = formatSlotTime(session.startsAt, sl.offsetMin);
          const draggedSlotIndex = draggedSlotId
            ? sortedSlots.findIndex((slot) => slot.id === draggedSlotId)
            : -1;
          const targetSlotIndex = sortedSlots.findIndex((slot) => slot.id === sl.id);
          const isDropInsertAfter =
            touchDragOverSlotId === sl.id &&
            draggedSlotIndex !== -1 &&
            draggedSlotIndex < targetSlotIndex;
          const dropHintLabel = isDropInsertAfter
            ? "Вставить после этого слота"
            : "Вставить перед этим слотом";
          return (
            <div
              key={sl.id}
              data-session-slot-id={sl.id}
              className={cn(
                "director-session-slots-panel__row",
                sl.id === selectedSlotId && "director-session-slots-panel__row--active",
                touchDragOverSlotId === sl.id && "director-session-slots-panel__row--drop-target",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                if (materialDragPayload) e.dataTransfer.dropEffect = "copy";
                else e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const payload =
                  parseDragSceneRef(e.dataTransfer) ?? materialDragPayload;
                if (payload) {
                  setMaterialDragPayload(null);
                  void attachSceneToSlotByDrop(sl.id, payload);
                  return;
                }
                const dragId = parseDragSlotId(e.dataTransfer) || draggedSlotId;
                if (!dragId) return;
                void moveSlotToTarget(dragId, sl.id);
              }}
            >
              <ListItem
                className={cn(
                  "session-slot",
                  sl.id === selectedSlotId && "session-slot--active",
                  draggedSlotId === sl.id && "session-slot--dragging",
                  slotToneClassById?.get(sl.id),
                )}
              >
                <span
                  className="director-session-slots-panel__drag"
                  title="Перетащи, чтобы изменить порядок"
                  role="presentation"
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    touchDragPointerIdRef.current = e.pointerId;
                    touchDragOverSlotIdRef.current = null;
                    updateTouchDragPreview(e.clientX, e.clientY);
                    setDraggedSlotId(sl.id);
                    setTouchDragOverSlotId(null);
                    setIsTouchDraggingSlot(true);
                  }}
                >
                  ⋮⋮
                </span>
                <Button
                  type="button"
                  className="rehearsals-item director-session-slots-panel__slot-main"
                  onClick={() => onSelectSlot(sl.id)}
                >
                  <div className="sessions-slot-head">
                    <div className="sessions-slot-head__left">
                      <div className="sessions-slot-title" title={slotTime}>
                        <span
                          className="director-session-slots-panel__status-dot"
                          aria-hidden="true"
                        />
                        <span className="sessions-slot-title__text">
                          {slotTime}
                        </span>
                      </div>
                      {display.projectLabel ? (
                        <div
                          className={cn(
                            "sessions-slot-meta",
                            display.isProgRun && "sessions-slot-meta--prog-run",
                          )}
                          title={display.projectLabel}
                        >
                          {display.projectLabel}
                        </div>
                      ) : null}
                    </div>
                    <div className="sessions-slot-head__right">
                      {display.materialLabel ? (
                        <div
                          className="sessions-slot-project"
                          title={display.materialLabel}
                        >
                          {display.materialLabel}
                        </div>
                      ) : null}
                      <Buttons.DeleteButton
                        type="button"
                        className="sessions-slot-title__btn-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          void removeSlot(sl.id);
                        }}
                      />
                    </div>
                  </div>
                  {String(sl.notes ?? "").trim() ? (
                    <div
                      className="sessions-slot-notes"
                      title={String(sl.notes).trim()}
                    >
                      {String(sl.notes).trim()}
                    </div>
                  ) : null}
                </Button>
              </ListItem>
              {touchDragOverSlotId === sl.id ? (
                <div className="director-session-slots-panel__drop-hint">
                  {dropHintLabel}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {draggedSlotForTouchPreview ? (
        <div
          ref={touchDragPreviewRef}
          className={cn(
            "director-session-slots-panel__touch-preview",
            slotToneClassById?.get(draggedSlotForTouchPreview.id),
          )}
          aria-hidden="true"
        >
          <span className="director-session-slots-panel__drag">
            ⋮⋮
          </span>
          <div className="director-session-slots-panel__touch-preview-main">
            <div className="sessions-slot-head">
              <div className="sessions-slot-head__left">
                <div
                  className="sessions-slot-title"
                  title={formatSlotTime(
                    session.startsAt,
                    draggedSlotForTouchPreview.offsetMin,
                  )}
                >
                  <span className="director-session-slots-panel__status-dot" />
                  <span className="sessions-slot-title__text">
                    {formatSlotTime(
                      session.startsAt,
                      draggedSlotForTouchPreview.offsetMin,
                    )}
                  </span>
                </div>
                {draggedSlotDisplay?.projectLabel ? (
                  <div
                    className={cn(
                      "sessions-slot-meta",
                      draggedSlotDisplay.isProgRun &&
                        "sessions-slot-meta--prog-run",
                    )}
                    title={draggedSlotDisplay.projectLabel}
                  >
                    {draggedSlotDisplay.projectLabel}
                  </div>
                ) : null}
              </div>
              {draggedSlotDisplay?.materialLabel ? (
                <div className="sessions-slot-head__right">
                  <div
                    className="sessions-slot-project"
                    title={draggedSlotDisplay.materialLabel}
                  >
                    {draggedSlotDisplay.materialLabel}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {busyConflictError ? (
        <div
          className="director-session-slots-panel__busy-error"
          role="alert"
        >
          <p className="director-session-slots-panel__busy-error-text">
            {busyConflictError}
          </p>
          {onDismissBusyConflictError ? (
            <button
              type="button"
              className="director-session-slots-panel__busy-error-dismiss"
              onClick={onDismissBusyConflictError}
            >
              Понятно
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="director-session-slots-panel__footer-actions">
        <Button
          type="button"
          disabled={!canSuggestIdleOrder}
          title={
            canSuggestIdleOrder
              ? "Переставить сцены так, чтобы актёры меньше простаивали"
              : "Нужно минимум 2 слота со сценами"
          }
          onClick={openIdleOrderPreview}
        >
          Собрать без простоя
        </Button>
        <Buttons.AddButton
          type="button"
          onClick={() => void addSlot()}
          title="Новый слот"
        />
      </div>
      {idleOrderPreview ? (
        <Modal
          isOpen
          onClose={() => {
            setIdleOrderPreview(null);
            setIdleOrderBusyEmails([]);
          }}
          panelClassName="director-session-idle-order-modal"
          ariaLabel="Порядок без простоя"
        >
          <div className="director-session-idle-order-modal__body">
            <div className="director-session-idle-order-modal__content">
              <h2 className="director-session-idle-order-modal__title">
                Собрать без простоя
              </h2>
              <p className="director-session-idle-order-modal__metric">
                Простой актёров: {idleOrderPreview.before.totalIdleMin} →{" "}
                {idleOrderPreview.after.totalIdleMin} мин
                {idleOrderPreview.before.actorsWithIdle !==
                idleOrderPreview.after.actorsWithIdle
                  ? ` · с простоем: ${idleOrderPreview.before.actorsWithIdle} → ${idleOrderPreview.after.actorsWithIdle}`
                  : null}
              </p>
              <ol className="director-session-idle-order-modal__list">
                {(() => {
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
                  return idleOrderPreview.order.map((id, index) => {
                    const sl = (session.slots ?? []).find((s) => s.id === id);
                    if (!sl) return null;
                    const display = getSlotDisplay(sl);
                    const sceneTitle = display.projectLabel;
                    const projectTitle = display.materialLabel;
                    const timeLabel = formatSlotTime(
                      session.startsAt,
                      offsets[id] ?? 0,
                    );
                    const durationMin = durationBySlotId[id] ?? sl.durationMin;
                    return (
                      <li key={id}>
                        <span className="director-session-idle-order-modal__item-title">
                          {index + 1}. {timeLabel} · {sceneTitle}
                        </span>
                        <span className="director-session-idle-order-modal__item-meta">
                          {projectTitle}
                          {durationMin
                            ? ` · ${Math.max(1, Math.floor(Number(durationMin) || 1))} мин`
                            : null}
                        </span>
                      </li>
                    );
                  });
                })()}
              </ol>
              {idleOrderBusyEmails.length > 0 ? (
                <p
                  className="director-session-idle-order-modal__warn"
                  role="status"
                >
                  После нового порядка занятость конфликтует у:{" "}
                  {idleOrderBusyEmails.join(", ")}
                </p>
              ) : null}
            </div>
            <div className="director-session-idle-order-modal__actions">
              <Button
                type="button"
                onClick={() => {
                  setIdleOrderPreview(null);
                  setIdleOrderBusyEmails([]);
                }}
              >
                Отмена
              </Button>
              <Button
                type="button"
                onClick={() => void applyIdleOrderPreview()}
              >
                Применить
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
      {selectedSlotForModal ? (
        <Modal
          isOpen
          onClose={onRequestCloseSlot}
          panelClassName="director-session-slot-modal"
          ariaLabel="Параметры слота"
        >
          <div className="director-session-slot-modal__body">
            {busyConflictError ? (
              <div
                className="director-session-slots-panel__busy-error director-session-slots-panel__busy-error--modal"
                role="alert"
              >
                <p className="director-session-slots-panel__busy-error-text">
                  {busyConflictError}
                </p>
              </div>
            ) : null}
            <div
              className={cn(
                "sessions-slot-controls",
                "director-session-slots-panel__controls",
                "director-session-slot-modal__time-row",
              )}
            >
              <input
                type="time"
                className="director-session-slot-modal__textlike"
                aria-label="Время начала слота"
                value={
                  slotDraft[selectedSlotForModal.id]?.time ??
                  formatSlotTime(
                    session.startsAt,
                    selectedSlotForModal.offsetMin,
                  )
                }
                onChange={(e) =>
                  setSlotDraft((p) => ({
                    ...p,
                    [selectedSlotForModal.id]: {
                      ...(p[selectedSlotForModal.id] ?? {
                        time: "",
                        durationHours: "0",
                        durationMinutes: "30",
                      }),
                      time: e.target.value,
                    },
                  }))
                }
                onBlur={() => void commitSlotDraft(selectedSlotForModal.id)}
              />
              <span className="director-session-slot-modal__duration-container">
                <input
                  type="number"
                  min={0}
                  max={8}
                  className={cn(
                    "director-session-slot-modal__textlike",
                    "director-session-slot-modal__textlike--duration",
                    "director-session-slot-modal__textlike--duration-hours",
                  )}
                  aria-label="Длительность слота, часы"
                  value={
                    slotDraft[selectedSlotForModal.id]?.durationHours ??
                    String(
                      durationPartsFromMin(
                        selectedSlotForModal.durationMin ?? 30,
                      ).hours,
                    )
                  }
                  onChange={(e) =>
                    setSlotDraft((p) => ({
                      ...p,
                      [selectedSlotForModal.id]: {
                        ...(p[selectedSlotForModal.id] ?? {
                          time: "",
                          durationHours: "0",
                          durationMinutes: "30",
                        }),
                        durationHours: e.target.value,
                      },
                    }))
                  }
                  onBlur={() => void commitSlotDraft(selectedSlotForModal.id)}
                />
                <span className="director-session-slot-modal__duration-suffix">
                  ч
                </span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  className={cn(
                    "director-session-slot-modal__textlike",
                    "director-session-slot-modal__textlike--duration",
                    "director-session-slot-modal__textlike--duration-minutes",
                  )}
                  aria-label="Длительность слота, минуты"
                  value={
                    slotDraft[selectedSlotForModal.id]?.durationMinutes ??
                    String(
                      durationPartsFromMin(
                        selectedSlotForModal.durationMin ?? 30,
                      ).minutes,
                    )
                  }
                  onChange={(e) =>
                    setSlotDraft((p) => ({
                      ...p,
                      [selectedSlotForModal.id]: {
                        ...(p[selectedSlotForModal.id] ?? {
                          time: "",
                          durationHours: "0",
                          durationMinutes: "30",
                        }),
                        durationMinutes: e.target.value,
                      },
                    }))
                  }
                  onBlur={() => void commitSlotDraft(selectedSlotForModal.id)}
                />
                <span className="director-session-slot-modal__duration-suffix">
                  мин
                </span>
              </span>
              <button
                type="button"
                className="director-session-slot-modal__close"
                onClick={onRequestCloseSlot}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            {slotSettings ? (
              <div className="director-session-slots-panel__slot-settings">
                {slotSettings}
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </RehearsalsCard>
  );
}
