import { useEffect, useState } from "react";
import { Button } from "@shared/core/button/Button";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { Modal } from "@shared/core/modal/Modal";
import type { AvailabilityTimeRange } from "../model/availability-calendar";
import "./availability-day-modal.css";

type AvailabilityRangeTimeModalProps = {
  isOpen: boolean;
  rangeLabel: string | null;
  onClose: () => void;
  onApply: (range: AvailabilityTimeRange) => void;
};

export function AvailabilityRangeTimeModal({
  isOpen,
  rangeLabel,
  onClose,
  onApply,
}: AvailabilityRangeTimeModalProps) {
  const [timeFrom, setTimeFrom] = useState("19:00");
  const [timeTo, setTimeTo] = useState("21:00");

  useEffect(() => {
    if (!isOpen) return;
    setTimeFrom("19:00");
    setTimeTo("21:00");
  }, [isOpen]);

  const timeIsValid = timeFrom < timeTo;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="availability-day-modal"
      ariaLabelledBy="availability-range-time-modal-title"
    >
      <div className="availability-day-modal__header">
        <h3
          id="availability-range-time-modal-title"
          className="availability-day-modal__title"
        >
          Диапазон времени
        </h3>
        <button
          type="button"
          className="availability-day-modal__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>

      <div className="availability-day-modal__body">
        {rangeLabel ? (
          <div className="availability-day-modal__hint">
            Применится к {rangeLabel}.
          </div>
        ) : null}
        <div className="availability-day-modal__label">Окно доступности</div>
        <div className="availability-day-modal__time-row">
          <InlineTextField
            className="availability-day-modal__time-input"
            type="time"
            aria-label="Начало окна"
            value={timeFrom}
            onChange={(e) => setTimeFrom(e.target.value)}
          />
          <div className="availability-day-modal__time-sep">—</div>
          <InlineTextField
            className="availability-day-modal__time-input"
            type="time"
            aria-label="Конец окна"
            value={timeTo}
            onChange={(e) => setTimeTo(e.target.value)}
          />
        </div>
      </div>

      <div className="availability-day-modal__foot">
        <Button
          type="button"
          disabled={!timeIsValid}
          onClick={() => {
            if (!timeIsValid) return;
            onApply({ from: timeFrom, to: timeTo });
            onClose();
          }}
        >
          Применить
        </Button>
      </div>
    </Modal>
  );
}
