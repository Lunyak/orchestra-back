import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { Button } from "@shared/core/button/Button";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { Modal } from "@shared/core/modal/Modal";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import type {
  AvailabilityStatus,
  AvailabilityTimeRange,
} from "../model/availability-calendar";
import {
  profileDataActions,
  selectProfileForm,
} from "../model/profileDataSlice";
import "./availability-day-modal.css";

dayjs.locale("ru");

export type AvailabilityDaySessionItem = {
  id: string;
  timeLabel: string;
  title: string;
};

type AvailabilityDayModalProps = {
  isOpen: boolean;
  dateIso: string | null;
  onClose: () => void;
  sessions?: AvailabilityDaySessionItem[];
  onSessionClick?: (sessionId: string) => void;
};

export function AvailabilityDayModal({
  isOpen,
  dateIso,
  onClose,
  sessions,
  onSessionClick,
}: AvailabilityDayModalProps) {
  const dispatch = useAppDispatch();
  const form = useAppSelector(selectProfileForm);
  const selectedDate = dateIso ?? "";
  const calendar = (form.availabilityCalendar ?? {}) as Record<
    string,
    AvailabilityStatus
  >;
  const rangesByDay = (form.availabilityTimeRanges ?? {}) as Record<
    string,
    AvailabilityTimeRange[]
  >;
  const selectedStatus = (calendar[selectedDate] ?? null) as
    | AvailabilityStatus
    | null;
  const selectedRanges = rangesByDay[selectedDate] ?? [];
  const dateLabel = selectedDate
    ? dayjs(selectedDate).format("D MMMM YYYY")
    : "";
  const showSessions = sessions != null;
  const daySessions = sessions ?? [];

  return (
    <Modal
      isOpen={isOpen && Boolean(selectedDate)}
      onClose={onClose}
      panelClassName="availability-day-modal"
      ariaLabelledBy="availability-day-modal-title"
    >
      <div className="availability-day-modal__header">
        <h3
          id="availability-day-modal-title"
          className="availability-day-modal__title"
        >
          {dateLabel}
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
        <div className="availability-day-modal__label">Статус дня</div>
        <div className="availability-day-modal__status-row">
          <Button
            className={cn(
              selectedStatus == null ? "button--active" : "secondary",
            )}
            type="button"
            onClick={() =>
              dispatch(
                profileDataActions.setAvailabilityDayStatus({
                  date: selectedDate,
                  status: null,
                }),
              )
            }
          >
            Не отмечено
          </Button>
          <Button
            className={cn(
              selectedStatus === "present" ? "button--active" : "secondary",
            )}
            type="button"
            onClick={() =>
              dispatch(
                profileDataActions.setAvailabilityDayStatus({
                  date: selectedDate,
                  status: "present",
                }),
              )
            }
          >
            Свободен
          </Button>
          <Button
            className={cn(
              selectedStatus === "absent" && "danger",
              selectedStatus === "absent" ? "button--active" : "secondary",
            )}
            type="button"
            onClick={() =>
              dispatch(
                profileDataActions.setAvailabilityDayStatus({
                  date: selectedDate,
                  status: "absent",
                }),
              )
            }
          >
            Занят
          </Button>
        </div>

        <div className="availability-day-modal__time-block">
          <div className="availability-day-modal__label">
            Окна доступности для сессий
          </div>
          {selectedStatus !== "present" ? (
            <div className="availability-day-modal__hint">
              Поля времени появляются после выбора «Свободен». Если весь день
              занят — выберите «Занят».
            </div>
          ) : selectedRanges.length === 0 ? (
            <div className="availability-day-modal__hint">
              Интервалы не заданы — доступен весь день. «+ Добавить диапазон»,
              если свободны только часть дня.
            </div>
          ) : (
            <div className="availability-day-modal__time-ranges">
              {selectedRanges.map((range, idx) => (
                <div
                  key={`${selectedDate}:${idx}`}
                  className="availability-day-modal__time-row"
                >
                  <InlineTextField
                    className="availability-day-modal__time-input"
                    type="time"
                    value={range.from}
                    onChange={(e) => {
                      const next = selectedRanges.slice();
                      next[idx] = { ...next[idx]!, from: e.target.value };
                      dispatch(
                        profileDataActions.setTimeRangesForDate({
                          date: selectedDate,
                          ranges: next,
                        }),
                      );
                    }}
                  />
                  <div className="availability-day-modal__time-sep">—</div>
                  <InlineTextField
                    className="availability-day-modal__time-input"
                    type="time"
                    value={range.to}
                    onChange={(e) => {
                      const next = selectedRanges.slice();
                      next[idx] = { ...next[idx]!, to: e.target.value };
                      dispatch(
                        profileDataActions.setTimeRangesForDate({
                          date: selectedDate,
                          ranges: next,
                        }),
                      );
                    }}
                  />
                  <Button
                    className="danger"
                    type="button"
                    onClick={() => {
                      const next = selectedRanges.slice();
                      next.splice(idx, 1);
                      dispatch(
                        profileDataActions.setTimeRangesForDate({
                          date: selectedDate,
                          ranges: next,
                        }),
                      );
                    }}
                  >
                    Удалить
                  </Button>
                </div>
              ))}
            </div>
          )}

          {selectedStatus === "present" ? (
            <div className="availability-day-modal__time-actions">
              <Button
                className="primary"
                type="button"
                onClick={() => {
                  const next = [
                    ...selectedRanges,
                    { from: "19:00", to: "21:00" },
                  ];
                  dispatch(
                    profileDataActions.setTimeRangesForDate({
                      date: selectedDate,
                      ranges: next,
                    }),
                  );
                }}
              >
                + Добавить диапазон
              </Button>
              {selectedRanges.length > 0 ? (
                <Button
                  className="danger"
                  type="button"
                  onClick={() =>
                    dispatch(
                      profileDataActions.setTimeRangesForDate({
                        date: selectedDate,
                        ranges: [],
                      }),
                    )
                  }
                >
                  Очистить время
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {showSessions ? (
          <>
            <div className="availability-day-modal__sessions-title">
              Сессии в этот день
            </div>
            <div className="availability-day-modal__sessions">
              {daySessions.length === 0 ? (
                <div className="availability-day-modal__hint">
                  Нет сессий в этот день.
                </div>
              ) : (
                daySessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className="availability-day-modal__session"
                    onClick={() => onSessionClick?.(session.id)}
                  >
                    <span className="availability-day-modal__session-time">
                      {session.timeLabel}
                    </span>
                    <span className="availability-day-modal__session-title">
                      {session.title}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : null}
      </div>

      <div className="availability-day-modal__foot">
        <Button type="button" onClick={onClose}>
          Готово
        </Button>
      </div>
    </Modal>
  );
}
