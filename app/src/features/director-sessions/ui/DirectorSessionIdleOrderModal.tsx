import { Button } from "@shared/core/button/Button";
import { Modal } from "@shared/core/modal/Modal";
import type { IdleOrderSuggestion } from "../model/session-slot-idle-order";
import type { IdleOrderPreviewItem } from "../model/useDirectorSessionSlotsPanel";

type DirectorSessionIdleOrderModalProps = {
  preview: IdleOrderSuggestion;
  items: IdleOrderPreviewItem[];
  busyEmails: string[];
  onClose: () => void;
  onApply: () => void;
};

export function DirectorSessionIdleOrderModal({
  preview,
  items,
  busyEmails,
  onClose,
  onApply,
}: DirectorSessionIdleOrderModalProps) {
  const actorsIdleChanged =
    preview.before.actorsWithIdle !== preview.after.actorsWithIdle;
  const hasBusyEmails = busyEmails.length > 0;

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
              return (
                <li key={item.id}>
                  <span className="director-session-idle-order-modal__item-title">
                    {item.index + 1}. {item.timeLabel} · {item.sceneTitle}
                  </span>
                  <span className="director-session-idle-order-modal__item-meta">
                    {item.projectTitle}
                    {item.durationMin ? ` · ${durationLabel} мин` : null}
                  </span>
                </li>
              );
            })}
          </ol>
          {hasBusyEmails ? (
            <p
              className="director-session-idle-order-modal__warn"
              role="status"
            >
              После нового порядка занятость конфликтует у:{" "}
              {busyEmails.join(", ")}
            </p>
          ) : null}
        </div>
        <div className="director-session-idle-order-modal__actions">
          <Button type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" onClick={onApply}>
            Применить
          </Button>
        </div>
      </div>
    </Modal>
  );
}
