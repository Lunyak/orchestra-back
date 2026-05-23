import { Buttons } from "@shared/components/buttons/Buttons";
import { ListItem } from "@shared/components/list-item/ListItem";
import { Button } from "@shared/core/button/Button";
import { Modal } from "@shared/core/modal/Modal";
import cn from "classnames";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import type {
  DirectorRehearsalSession,
  DirectorSessionSlot,
} from "../directorSessionsSync";
import { createId } from "../../../shared/utils/createId";
import "../../../pages/sessions/style.css";

const DND_MIME_SLOT_ID = "application/x-orchestra-director-session-slot";
const DND_MIME_STEP_REF = "application/x-orchestra-director-session-step-ref";

type DragStepRefPayload = {
  kind: "stepRef";
  projectSlug: string;
  stepId: number;
  durationMin?: number;
};

function parseDragStepRef(dt: DataTransfer): DragStepRefPayload | null {
  const raw = dt.getData(DND_MIME_STEP_REF);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<DragStepRefPayload> | null;
    if (!v || v.kind !== "stepRef") return null;
    const projectSlug = String(v.projectSlug ?? "").trim();
    const stepId = Number(v.stepId);
    const durationMin =
      v.durationMin == null
        ? undefined
        : Math.max(1, Math.floor(Number(v.durationMin)));
    if (!projectSlug) return null;
    if (!Number.isFinite(stepId) || stepId <= 0) return null;
    return { kind: "stepRef", projectSlug, stepId, durationMin };
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

function guessDurationMin(payload: DragStepRefPayload): number {
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
  persistSessions: (next: DirectorRehearsalSession[]) => Promise<void>;
  /** Блок настроек слота (проект, шаг, превью, заметки) — в модалке по выбранному слоту */
  slotSettings?: React.ReactNode;
  onRequestCloseSlot: () => void;
  /** Доп. класс на карточке слота (напр. доступность по ролям на странице одной сессии) */
  slotToneClassById?: Map<string, string> | null;
};

export function DirectorSessionSlotsPanel({
  session,
  sessions,
  selectedSlotId,
  onSelectSlot,
  onNoSlotsLeft,
  persistSessions,
  slotSettings,
  onRequestCloseSlot,
  slotToneClassById,
}: DirectorSessionSlotsPanelProps) {
  const [autoShiftFollowing, setAutoShiftFollowing] = useState(true);
  const [timelineDragOver, setTimelineDragOver] = useState(false);
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [materialDragPayload, setMaterialDragPayload] =
    useState<DragStepRefPayload | null>(null);

  const [slotDraft, setSlotDraft] = useState<
    Record<string, { time: string; duration: string }>
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
      await persistSessions(mergeSession(nextSession));
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
    await updateActiveSession({
      slots: [...(session.slots ?? []), slot],
    });
    onSelectSlot(slot.id);
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

  const moveSlotBefore = async (dragId: string, beforeId: string) => {
    if (dragId === beforeId) return;
    const sorted = [...(session.slots ?? [])].sort(
      (a, b) => a.offsetMin - b.offsetMin,
    );
    const fromIndex = sorted.findIndex((s) => s.id === dragId);
    const toIndex = sorted.findIndex((s) => s.id === beforeId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...sorted];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    await updateActiveSession({ slots: packSlotsSequentialInOrder(next) });
  };

  const attachStepToSlotByDrop = async (
    slotId: string,
    payload: DragStepRefPayload,
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
        ref: { projectSlug: payload.projectSlug, stepId: payload.stepId },
        durationMin: nextDur,
      },
      { shiftFollowing: autoShiftFollowing, deltaMin: delta },
    );
    onSelectSlot(slotId);
    setSlotDraft((p) => ({
      ...p,
      [slotId]: {
        ...(p[slotId] ?? {
          time: formatSlotTime(session.startsAt, current.offsetMin),
          duration: "",
        }),
        duration: String(nextDur),
      },
    }));
  };

  const addSlotFromDroppedStep = async (payload: DragStepRefPayload) => {
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
      ref: { projectSlug: payload.projectSlug, stepId: payload.stepId },
    };
    await updateActiveSession({
      slots: [...(session.slots ?? []), slot],
    });
    onSelectSlot(slot.id);
  };

  useEffect(() => {
    setSlotDraft((prev) => {
      const next = { ...prev };
      for (const sl of session.slots ?? []) {
        if (!next[sl.id]) {
          next[sl.id] = {
            time: formatSlotTime(session.startsAt, sl.offsetMin),
            duration: String(sl.durationMin ?? 30),
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
    const durNum = Math.max(1, Math.min(480, Math.floor(Number(d.duration))));
    const nextOffset =
      abs == null ? sl.offsetMin : Math.max(0, Math.floor(abs - base));
    const prevDur = Math.max(1, Math.floor(sl.durationMin || 1));
    const delta = durNum - prevDur;
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
          timelineDragOver && "dropActive",
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
            parseDragStepRef(e.dataTransfer) ?? materialDragPayload;
          setTimelineDragOver(false);
          setMaterialDragPayload(null);
          if (!payload) return;
          e.preventDefault();
          void addSlotFromDroppedStep(payload);
        }}
        title="Сюда можно перетащить шаг сценария — появится новый слот с материалом"
      >
        {sortedSlots.length === 0 && (
          <div className="sessions-slots-empty rehearsals-muted">
            Слотов нет — нажми «+» или перетащи шаг сюда.
          </div>
        )}
        {sortedSlots.map((sl) => (
          <div
            key={sl.id}
            className={cn(
              "director-session-slots-panel__row",
              sl.id === selectedSlotId && "active",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              if (materialDragPayload) e.dataTransfer.dropEffect = "copy";
              else e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const payload =
                parseDragStepRef(e.dataTransfer) ?? materialDragPayload;
              if (payload) {
                setMaterialDragPayload(null);
                void attachStepToSlotByDrop(sl.id, payload);
                return;
              }
              const dragId = parseDragSlotId(e.dataTransfer) || draggedSlotId;
              if (!dragId) return;
              void moveSlotBefore(dragId, sl.id);
            }}
          >
            <ListItem
              className={cn(
                "session-slot",
                sl.id === selectedSlotId && "active",
                draggedSlotId === sl.id && "dragging",
                slotToneClassById?.get(sl.id),
              )}
            >
              <span
                className="sessions-sessionRow__dragHandle director-session-slots-panel__drag"
                draggable
                title="Перетащи, чтобы изменить порядок"
                role="presentation"
                onPointerDown={(e) => e.stopPropagation()}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", sl.id);
                  e.dataTransfer.setData(DND_MIME_SLOT_ID, sl.id);
                  e.dataTransfer.effectAllowed = "move";
                  setDraggedSlotId(sl.id);
                }}
                onDragEnd={() => setDraggedSlotId(null)}
              >
                ⋮⋮
              </span>
              <Button
                type="button"
                className="rehearsals-item director-session-slots-panel__slot-main"
                onClick={() => onSelectSlot(sl.id)}
              >
                <div className="sessions-slot-head">
                  <div className="sessions-slot-title">
                    {formatSlotTime(session.startsAt, sl.offsetMin)} · {sl.durationMin} мин
                  </div>
                  <Buttons.DeleteButton
                    type="button"
                    className="sessions-slot-title__btn-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeSlot(sl.id);
                    }}
                  />
                </div>
                <div className="sessions-slot-meta">
                  {sl.ref
                    ? `${sl.ref.projectSlug} · шаг #${sl.ref.stepId}`
                    : "Материал не выбран"}
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
          </div>
        ))}
      </div>
      <Buttons.AddButton type="button" onClick={() => void addSlot()} title="Новый слот" />
      {selectedSlotForModal ? (
        <Modal
          isOpen
          onClose={onRequestCloseSlot}
          panelClassName="director-session-slot-modal-panel"
          ariaLabel="Параметры слота"
        >
          <Buttons.CloseButton
            type="button"
            className="director-session-slot-modal__close"
            onClick={onRequestCloseSlot}
            aria-label="Закрыть"
          >
            ×
          </Buttons.CloseButton>
          <div className="director-session-slot-modal__body">
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
                        duration: "",
                      }),
                      time: e.target.value,
                    },
                  }))
                }
                onBlur={() => void commitSlotDraft(selectedSlotForModal.id)}
              />
              <span className="director-session-slot-modal__duration-wrap">
                <input
                  type="number"
                  min={1}
                  max={480}
                  className={cn(
                    "director-session-slot-modal__textlike",
                    "director-session-slot-modal__textlike--duration",
                  )}
                  aria-label="Длительность слота, минуты"
                  value={
                    slotDraft[selectedSlotForModal.id]?.duration ??
                    String(selectedSlotForModal.durationMin ?? 30)
                  }
                  onChange={(e) =>
                    setSlotDraft((p) => ({
                      ...p,
                      [selectedSlotForModal.id]: {
                        ...(p[selectedSlotForModal.id] ?? {
                          time: "",
                          duration: "",
                        }),
                        duration: e.target.value,
                      },
                    }))
                  }
                  onBlur={() => void commitSlotDraft(selectedSlotForModal.id)}
                />
                <span className="director-session-slot-modal__duration-suffix">
                  мин
                </span>
              </span>
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
