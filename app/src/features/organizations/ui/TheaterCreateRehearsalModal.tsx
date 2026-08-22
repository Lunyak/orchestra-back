import { Modal } from "@shared/core/modal/Modal";
import { Button } from "@shared/core/button/Button";
import "./theater-create-rehearsal-modal.css";

type TheaterCreateRehearsalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  dateLabel: string;
  createTime: string;
  timeStepMin: number;
  onCreateTimeChange: (time: string) => void;
  createError: string;
  creating: boolean;
  canSubmit: boolean;
  createTimeTaken: boolean;
  onConfirm: () => void;
};

export function TheaterCreateRehearsalModal({
  isOpen,
  onClose,
  dateLabel,
  createTime,
  timeStepMin,
  onCreateTimeChange,
  createError,
  creating,
  canSubmit,
  createTimeTaken,
  onConfirm,
}: TheaterCreateRehearsalModalProps) {
  const confirmTitle = createTimeTaken
    ? `Время ${createTime} пересекается с занятым интервалом`
    : `Создать репетицию на ${dateLabel}, ${createTime}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="theater-create-rehearsal-modal"
      ariaLabelledBy="theater-create-rehearsal-modal-title"
    >
      <div className="theater-create-rehearsal-modal__body">
        <h2
          id="theater-create-rehearsal-modal-title"
          className="theater-create-rehearsal-modal__title"
        >
          Новая репетиция
        </h2>
        <p className="theater-create-rehearsal-modal__date rehearsals-muted">
          {dateLabel}
        </p>
        <label className="theater-create-rehearsal-modal__time">
          <span className="theater-create-rehearsal-modal__time-label">
            Время
          </span>
          <input
            type="time"
            className="native-text-input theater-create-rehearsal-modal__time-input"
            value={createTime}
            step={timeStepMin * 60}
            onChange={(event) => onCreateTimeChange(event.target.value)}
            aria-label="Время новой репетиции"
          />
        </label>
        {createError ? (
          <div className="rehearsals-error" role="alert">
            {createError}
          </div>
        ) : null}
        <div className="theater-create-rehearsal-modal__actions">
          <Button type="button" onClick={onClose} disabled={creating}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!canSubmit}
            title={confirmTitle}
          >
            {creating ? "Создание…" : "ОК"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
