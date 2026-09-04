import cn from "classnames";
import { MiniAvatar } from "@shared/components/mini-avatar/MiniAvatar";
import { Button } from "@shared/core/button/Button";
import { Modal } from "@shared/core/modal/Modal";
import {
  idleOrderBusyHint,
  idleOrderBusyImpact,
  idleOrderBusyLead,
  idleOrderBusyReason,
  idleOrderHasNewBusyConflict,
  type IdleOrderBusyConflict,
} from "../model/session-idle-order-busy";
import type { IdleOrderSuggestion } from "../model/session-slot-idle-order";
import type { IdleOrderPreviewItem } from "../model/useDirectorSessionSlotsPanel";

type DirectorSessionIdleOrderModalProps = {
  preview: IdleOrderSuggestion;
  items: IdleOrderPreviewItem[];
  busyConflicts: IdleOrderBusyConflict[];
  onClose: () => void;
  onApply: () => void;
};

function busyPeopleBySlotId(
  conflicts: IdleOrderBusyConflict[],
): Map<string, IdleOrderBusyConflict[]> {
  const bySlot = new Map<string, IdleOrderBusyConflict[]>();
  for (const conflict of conflicts) {
    for (const slot of conflict.slots) {
      const people = bySlot.get(slot.slotId) ?? [];
      people.push(conflict);
      bySlot.set(slot.slotId, people);
    }
  }
  return bySlot;
}

function IdleOrderBusyPerson({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  return (
    <span className="director-session-idle-order-modal__person">
      <MiniAvatar src={avatarUrl} label={name} size={22} title={name} />
      <span className="director-session-idle-order-modal__person-name">
        {name}
      </span>
    </span>
  );
}

export function DirectorSessionIdleOrderModal({
  preview,
  items,
  busyConflicts,
  onClose,
  onApply,
}: DirectorSessionIdleOrderModalProps) {
  const actorsIdleChanged =
    preview.before.actorsWithIdle !== preview.after.actorsWithIdle;
  const hasBusyConflicts = busyConflicts.length > 0;
  const hasNewBusyConflict = idleOrderHasNewBusyConflict(busyConflicts);
  const peopleBySlotId = busyPeopleBySlotId(busyConflicts);
  const applyLabel = hasBusyConflicts ? "Применить всё равно" : "Применить";
  const cancelLabel = hasBusyConflicts ? "Оставить как есть" : "Отмена";

  return (
    <Modal
      isOpen
      onClose={onClose}
      panelClassName="director-session-idle-order-modal"
      ariaLabel="Порядок без простоя"
    >
      <div className="director-session-idle-order-modal__body">
        <div className="director-session-idle-order-modal__content">
          <h2 className="director-session-idle-order-modal__title">
            Собрать без простоя
          </h2>
          <p className="director-session-idle-order-modal__metric">
            Простой актёров: {preview.before.totalIdleMin} →{" "}
            {preview.after.totalIdleMin} мин
            {actorsIdleChanged
              ? ` · с простоем: ${preview.before.actorsWithIdle} → ${preview.after.actorsWithIdle}`
              : null}
          </p>
          <ol className="director-session-idle-order-modal__list">
            {items.map((item) => {
              const durationLabel = Math.max(
                1,
                Math.floor(Number(item.durationMin) || 1),
              );
              const conflictPeople = peopleBySlotId.get(item.id) ?? [];
              const hasItemConflict = conflictPeople.length > 0;
              return (
                <li
                  key={item.id}
                  className={cn(
                    "director-session-idle-order-modal__item",
                    hasItemConflict &&
                      "director-session-idle-order-modal__item--busy",
                  )}
                >
                  <span className="director-session-idle-order-modal__item-title">
                    {item.index + 1}. {item.timeLabel} · {item.sceneTitle}
                  </span>
                  <span className="director-session-idle-order-modal__item-meta">
                    {item.projectTitle}
                    {item.durationMin ? ` · ${durationLabel} мин` : null}
                  </span>
                  {hasItemConflict ? (
                    <span className="director-session-idle-order-modal__item-conflict">
                      Не свободен в это время:
                      <span className="director-session-idle-order-modal__item-people">
                        {conflictPeople.map((person) => (
                          <IdleOrderBusyPerson
                            key={person.email}
                            name={person.name}
                            avatarUrl={person.avatarUrl}
                          />
                        ))}
                      </span>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
          {hasBusyConflicts ? (
            <div
              className="director-session-idle-order-modal__warn"
              role="status"
            >
              <p className="director-session-idle-order-modal__warn-lead">
                {idleOrderBusyLead(busyConflicts)}
              </p>
              <ul className="director-session-idle-order-modal__warn-list">
                {busyConflicts.map((conflict) => (
                  <li
                    key={conflict.email}
                    className="director-session-idle-order-modal__warn-item"
                  >
                    <IdleOrderBusyPerson
                      name={conflict.name}
                      avatarUrl={conflict.avatarUrl}
                    />
                    <span className="director-session-idle-order-modal__warn-reason">
                      {idleOrderBusyReason(conflict)}
                    </span>
                    <span className="director-session-idle-order-modal__warn-slots">
                      {idleOrderBusyImpact(conflict)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="director-session-idle-order-modal__warn-hint">
                {idleOrderBusyHint(busyConflicts)}
              </p>
            </div>
          ) : null}
        </div>
        <div className="director-session-idle-order-modal__actions">
          <Button
            type="button"
            variant={hasNewBusyConflict ? "primary" : "secondary"}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={hasNewBusyConflict ? "secondary" : "primary"}
            onClick={onApply}
          >
            {applyLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
