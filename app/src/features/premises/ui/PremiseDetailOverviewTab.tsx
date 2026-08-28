import { Button } from "@shared/core/button/Button";
import dayjs from "dayjs";
import type { TeamProfile } from "../../../sync/api/profile";
import type { PremiseSlotItem } from "../../../sync/api/premises";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import {
  formatRubles,
  getPremiseSlotActorLabel,
  slotBookingRentalId,
} from "../model/premise-detail-helpers";
import type { UpcomingSlotGroup } from "../model/premise-detail-types";
import { PremiseSlotActor } from "./PremiseSlotActor";

export type PremiseDetailOverviewTabProps = {
  todaySlots: PremiseSlotItem[];
  pendingSlots: PremiseSlotItem[];
  occupiedHours: number;
  occupiedDays: number;
  unpaidAmountRub: number;
  hasTrackedSlots: boolean;
  trackedSlotGroups: UpcomingSlotGroup[];
  memberProfileByEmail: Map<string, TeamProfile>;
  canManagePremise: boolean;
  rentalActionId: string | null;
  onOpenSlot: (slot: PremiseSlotItem) => void;
  onBookingRequestReview: (
    rentalId: string,
    status: "active" | "cancelled",
    title: string,
  ) => void;
};

export function PremiseDetailOverviewTab({
  todaySlots,
  pendingSlots,
  occupiedHours,
  occupiedDays,
  unpaidAmountRub,
  hasTrackedSlots,
  trackedSlotGroups,
  memberProfileByEmail,
  canManagePremise,
  rentalActionId,
  onOpenSlot,
  onBookingRequestReview,
}: PremiseDetailOverviewTabProps) {
  return (
    <div className="premises-overview">
      <div className="premises-overview__metrics">
        <RehearsalsCard className="premises-metric">
          <span className="premises-metric__label">Брони сегодня</span>
          <strong className="premises-metric__value">{todaySlots.length}</strong>
          <span className="premises-metric__detail">
            {todaySlots.length
              ? "остаются видимыми весь день"
              : "на сегодня броней нет"}
          </span>
        </RehearsalsCard>
        <RehearsalsCard className="premises-metric">
          <span className="premises-metric__label">Ожидают подтверждения</span>
          <strong className="premises-metric__value">
            {pendingSlots.length}
          </strong>
          <span className="premises-metric__detail">
            заявок за выбранный месяц
          </span>
        </RehearsalsCard>
        <RehearsalsCard className="premises-metric">
          <span className="premises-metric__label">Загрузка</span>
          <strong className="premises-metric__value">
            {occupiedHours.toLocaleString("ru-RU", {
              maximumFractionDigits: 1,
            })}{" "}
            ч
          </strong>
          <span className="premises-metric__detail">
            {occupiedDays} занятых дней
          </span>
        </RehearsalsCard>
        <RehearsalsCard className="premises-metric">
          <span className="premises-metric__label">К оплате</span>
          <strong className="premises-metric__value">
            {formatRubles(unpaidAmountRub)}
          </strong>
          <span className="premises-metric__detail">по неоплаченным броням</span>
        </RehearsalsCard>
      </div>

      <div className="premises-overview__columns">
        <RehearsalsCard fluid className="premises-upcoming-card">
          <div className="rehearsals-card-title">Ближайшие брони</div>
          {hasTrackedSlots ? (
            <div className="premises-upcoming-groups">
              {trackedSlotGroups.map((group) => (
                <section key={group.id} className="premises-upcoming-group">
                  <div className="premises-upcoming-group__header">
                    <h3 className="premises-upcoming-group__title">
                      {group.label}
                    </h3>
                    <span className="premises-upcoming-group__count">
                      {group.slots.length}
                    </span>
                  </div>
                  <ul className="premises-tracking-list">
                    {group.slots.map((slot) => {
                      const slotStart = dayjs(slot.startsAt);
                      const slotEnd = slotStart.add(slot.durationMin, "minute");
                      const showDateInItem =
                        group.id === "week" || group.id === "month";
                      const dateLabel = showDateInItem
                        ? slotStart.format("D MMM").replace(/\.$/, "")
                        : "";
                      const timeLabel = `${slotStart.format("HH:mm")} – ${slotEnd.format("HH:mm")}`;

                      return (
                        <li key={slot.id} className="premises-tracking-item">
                          <button
                            type="button"
                            className="premises-tracking-item__main"
                            onClick={() => onOpenSlot(slot)}
                          >
                            <span className="premises-tracking-item__when">
                              {dateLabel ? (
                                <>
                                  <span className="premises-tracking-item__date">
                                    {dateLabel}
                                  </span>
                                  <span
                                    className="premises-tracking-item__divider"
                                    aria-hidden="true"
                                  />
                                </>
                              ) : null}
                              <span className="premises-tracking-item__time">
                                {timeLabel}
                              </span>
                            </span>
                            <strong className="premises-tracking-item__title">
                              {slot.title}
                            </strong>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="premises-overview__empty rehearsals-muted">
              На ближайший месяц броней нет.
            </div>
          )}
        </RehearsalsCard>

        <RehearsalsCard fluid>
          <div className="rehearsals-card-title">Требуют внимания</div>
          <section className="premises-attention-section">
            <div className="premises-attention-section__title">
              Заявки на бронь
              {pendingSlots.length ? (
                <span className="premises-attention-section__count">
                  {pendingSlots.length}
                </span>
              ) : null}
            </div>
            {pendingSlots.length ? (
              <ul className="premises-tracking-list">
                {pendingSlots.map((slot) => {
                  const bookingRentalId = slotBookingRentalId(slot);
                  const slotStart = dayjs(slot.startsAt);
                  const slotEnd = slotStart.add(slot.durationMin, "minute");
                  const dateLabel = slotStart
                    .format("D MMM")
                    .replace(/\.$/, "");
                  const timeLabel = `${slotStart.format("HH:mm")} – ${slotEnd.format("HH:mm")}`;
                  const contactPhone = slot.contactPhone?.trim() || "";
                  const actorLabel = getPremiseSlotActorLabel(
                    slot,
                    memberProfileByEmail,
                  );

                  return (
                    <li
                      key={slot.id}
                      className="premises-tracking-item premises-tracking-item--request"
                    >
                      <button
                        type="button"
                        className="premises-tracking-item__main"
                        onClick={() => onOpenSlot(slot)}
                      >
                        <PremiseSlotActor
                          slot={slot}
                          profileByEmail={memberProfileByEmail}
                          hideName
                        />
                        <span className="premises-tracking-item__body">
                          <span className="premises-tracking-item__range">
                            <span className="premises-tracking-item__date">
                              {dateLabel}
                            </span>
                            <span
                              className="premises-tracking-item__divider"
                              aria-hidden="true"
                            />
                            <span className="premises-tracking-item__time">
                              {timeLabel}
                            </span>
                            {contactPhone ? (
                              <>
                                <span
                                  className="premises-tracking-item__divider"
                                  aria-hidden="true"
                                />
                                <span className="premises-tracking-item__phone">
                                  {contactPhone}
                                </span>
                              </>
                            ) : null}
                          </span>
                          {actorLabel ? (
                            <span className="premises-tracking-item__name">
                              {actorLabel}
                            </span>
                          ) : null}
                          <strong className="premises-tracking-item__title">
                            {slot.title}
                          </strong>
                        </span>
                      </button>
                      {canManagePremise && bookingRentalId ? (
                        <div className="premises-tracking-item__review">
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
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="premises-overview__empty rehearsals-muted">
                Нет заявок, ожидающих подтверждения.
              </div>
            )}
          </section>
        </RehearsalsCard>
      </div>
    </div>
  );
}
