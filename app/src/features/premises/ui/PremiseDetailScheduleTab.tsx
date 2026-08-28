import {
  CalendarSection,
  type CalendarSectionState,
} from "@shared/components/calendar/CalendarSection";
import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import dayjs from "dayjs";
import type { TeamProfile } from "../../../sync/api/profile";
import type {
  PremiseAvailabilityDay,
  PremiseSlotItem,
} from "../../../sync/api/premises";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import {
  formatDuration,
  formatRubles,
  getPremiseSlotActorLabel,
  minutesToTime,
  slotBookingRentalId,
} from "../model/premise-detail-helpers";
import {
  paymentStatusLabel,
  usageTypeLabel,
} from "../model/premise-detail-options";
import type { FreePremiseInterval } from "../model/premise-detail-types";
import { slotStatusLabel } from "../model/premise-utils";
import { PremiseSlotActor } from "./PremiseSlotActor";
import { PremiseSlotPeople } from "./PremiseSlotPeople";

export type PremiseDetailScheduleTabProps = {
  premiseId: string;
  canBook: boolean;
  canManagePremise: boolean;
  calendarSelectedDateLabel: string;
  slotsFetching: boolean;
  dots: Record<string, number>;
  selectedWorkingDay: PremiseAvailabilityDay | undefined;
  freeIntervals: FreePremiseInterval[];
  daySlots: PremiseSlotItem[];
  expandedSlotIds: Set<string>;
  memberProfileByEmail: Map<string, TeamProfile>;
  rentalActionId: string | null;
  onCalendarStateChange: (state: CalendarSectionState) => void;
  onOpenCreateSlot: () => void;
  onOpenCreateSlotForInterval: (interval: FreePremiseInterval) => void;
  onOpenEditSlot: (slot: PremiseSlotItem) => void;
  onDeleteSlot: (slot: PremiseSlotItem) => void;
  canEditSlot: (slot: PremiseSlotItem) => boolean;
  onToggleSlotExpanded: (slotId: string) => void;
  onBookingRequestReview: (
    rentalId: string,
    status: "active" | "cancelled",
    title: string,
  ) => void;
};

export function PremiseDetailScheduleTab({
  premiseId,
  canBook,
  canManagePremise,
  calendarSelectedDateLabel,
  slotsFetching,
  dots,
  selectedWorkingDay,
  freeIntervals,
  daySlots,
  expandedSlotIds,
  memberProfileByEmail,
  rentalActionId,
  onCalendarStateChange,
  onOpenCreateSlot,
  onOpenCreateSlotForInterval,
  onOpenEditSlot,
  onDeleteSlot,
  canEditSlot,
  onToggleSlotExpanded,
  onBookingRequestReview,
}: PremiseDetailScheduleTabProps) {
  return (
    <div className="sessions-layout">
      <aside className="sessions-side">
        <RehearsalsCard className="sessions-calendar-card">
          {canBook ? (
            <div className="sessions-calendar-toolbar">
              <Button
                type="button"
                onClick={onOpenCreateSlot}
                title={`Добавить слот на ${calendarSelectedDateLabel}`}
              >
                + Слот на день
              </Button>
            </div>
          ) : null}

          <CalendarSection
            className="sessions-calendar"
            storageMonthKey={`premise-${premiseId}-calendar-month`}
            onStateChange={onCalendarStateChange}
            dotsByDate={dots}
            onDayDoubleClick={() => {
              if (canBook) onOpenCreateSlot();
            }}
            showStatusMarks={false}
          />

          {slotsFetching ? (
            <p className="rehearsals-muted premises-calendar-fetching">
              Обновление слотов…
            </p>
          ) : null}
        </RehearsalsCard>
      </aside>

      <div className="sessions-main premises-day-panels">
        <RehearsalsCard fluid className="premises-day-panel">
          <div className="sessions-slots-readonly__header">
            <span className="rehearsals-section-title">Свободное время</span>
            {selectedWorkingDay ? (
              <span className="rehearsals-muted">
                {minutesToTime(selectedWorkingDay.startsAtMin)} —{" "}
                {minutesToTime(selectedWorkingDay.endsAtMin)}
              </span>
            ) : null}
          </div>
          <div className="premises-day-panel__scroll">
            {!selectedWorkingDay ? (
              <div className="premises-free-slots__empty rehearsals-muted">
                На этот день рабочее время не задано.
              </div>
            ) : freeIntervals.length ? (
              <div className="premises-free-slots">
                {freeIntervals.map((interval) => (
                  <button
                    key={interval.startsAt.toISOString()}
                    type="button"
                    className="premises-free-slot"
                    disabled={!canBook}
                    onClick={() => onOpenCreateSlotForInterval(interval)}
                    title={
                      canBook
                        ? "Забронировать этот интервал"
                        : "Нет права бронирования"
                    }
                  >
                    <strong>
                      {interval.startsAt.format("HH:mm")} —{" "}
                      {interval.endsAt.format("HH:mm")}
                    </strong>
                    <span>{formatDuration(interval.durationMin)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="premises-free-slots__empty rehearsals-muted">
                Свободных интервалов нет.
              </div>
            )}
          </div>
        </RehearsalsCard>
        <RehearsalsCard fluid className="premises-day-panel">
          <div className="sessions-slots-readonly">
            <div className="sessions-slots-readonly__header">
              <span className="rehearsals-section-title">
                Слоты на {calendarSelectedDateLabel}
              </span>
              {canBook ? (
                <Button type="button" onClick={onOpenCreateSlot}>
                  Добавить слот
                </Button>
              ) : null}
            </div>

            <div className="premises-day-panel__scroll">
              {daySlots.length === 0 ? (
                <div className="sessions-slots-empty rehearsals-muted">
                  На этот день броней нет
                </div>
              ) : (
                <div className="premises-day-slots">
                  {daySlots.map((slot) => {
                    const slotStart = dayjs(slot.startsAt);
                    const slotEnd = slotStart.add(slot.durationMin, "minute");
                    const slotRangeLabel = `${slotStart.format("HH:mm")} – ${slotEnd.format("HH:mm")}`;
                    const bookingRentalId = slotBookingRentalId(slot);
                    const contactPhone = slot.contactPhone?.trim() || "";
                    const actorLabel = getPremiseSlotActorLabel(
                      slot,
                      memberProfileByEmail,
                    );
                    const isExpanded = expandedSlotIds.has(slot.id);

                    return (
                      <div
                        key={slot.id}
                        className={cn(
                          "sessions-slots-readonly__row premises-slot-row",
                          isExpanded && "premises-slot-row--open",
                        )}
                      >
                        <div className="premises-slot-row__content">
                          <PremiseSlotActor
                            slot={slot}
                            profileByEmail={memberProfileByEmail}
                            hideName
                          />
                          <div className="premises-slot-row__body">
                            <div className="premises-slot-row__range">
                              <div className="premises-slot-row__range-main">
                                <span className="premises-slot-row__range-time">
                                  {slotRangeLabel}
                                </span>
                                {contactPhone ? (
                                  <>
                                    <span
                                      className="premises-slot-row__range-divider"
                                      aria-hidden="true"
                                    />
                                    <span className="premises-slot-row__range-phone">
                                      {contactPhone}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                              {canEditSlot(slot) ? (
                                <div className="premises-slot-row__actions">
                                  <Button
                                    type="button"
                                    onClick={() => onOpenEditSlot(slot)}
                                  >
                                    Изменить
                                  </Button>
                                  <Button
                                    type="button"
                                    className="danger"
                                    onClick={() => void onDeleteSlot(slot)}
                                  >
                                    Удалить
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            {actorLabel ? (
                              <div className="premises-slot-row__name">
                                {actorLabel}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {isExpanded ? (
                          <div className="premises-slot-row__details">
                            <div className="sessions-slots-readonly__meta">
                              <strong>{slot.title}</strong>
                              {" · "}
                              {slotStatusLabel(slot.status)}
                              {slot.rental ? (
                                <span className="premises-slot-rental-meta">
                                  {" · "}
                                  {usageTypeLabel(slot.rental.usageType)}
                                  {slot.rental.recurrenceType === "weekly"
                                    ? " · Регулярная"
                                    : ""}
                                  {slot.rental.agreement
                                    ? ` · Договор ${slot.rental.agreement.number}`
                                    : ""}
                                </span>
                              ) : null}
                            </div>
                            <PremiseSlotPeople
                              slot={slot}
                              profileByEmail={memberProfileByEmail}
                            />
                            {slot.purpose ? (
                              <div className="sessions-slots-readonly__notes">
                                <b>Для чего:</b> {slot.purpose}
                              </div>
                            ) : null}
                            {slot.rentalNotes ? (
                              <div className="sessions-slots-readonly__notes">
                                <b>Аренда:</b> {slot.rentalNotes}
                              </div>
                            ) : null}
                            {slot.rentalAmountRub != null ? (
                              <div className="sessions-slots-readonly__notes">
                                <b>Оплата:</b>{" "}
                                {formatRubles(slot.rentalAmountRub)}
                                {" · "}
                                {paymentStatusLabel(slot.paymentStatus)}
                              </div>
                            ) : null}
                            {canManagePremise &&
                            slot.status === "pending" &&
                            bookingRentalId ? (
                              <div className="premises-slot-row__review">
                                <Button
                                  type="button"
                                  disabled={rentalActionId === bookingRentalId}
                                  onClick={() =>
                                    void onBookingRequestReview(
                                      bookingRentalId,
                                      "active",
                                      slot.title,
                                    )
                                  }
                                >
                                  Подтвердить
                                </Button>
                                <Button
                                  type="button"
                                  className="danger"
                                  disabled={rentalActionId === bookingRentalId}
                                  onClick={() =>
                                    void onBookingRequestReview(
                                      bookingRentalId,
                                      "cancelled",
                                      slot.title,
                                    )
                                  }
                                >
                                  Отклонить
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="premises-slot-row__chevron"
                          aria-expanded={isExpanded}
                          aria-label={
                            isExpanded ? "Свернуть слот" : "Раскрыть слот"
                          }
                          onClick={() => onToggleSlotExpanded(slot.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </RehearsalsCard>
      </div>
    </div>
  );
}
