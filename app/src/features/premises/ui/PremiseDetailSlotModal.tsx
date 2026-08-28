import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { Modal } from "@shared/core/modal/Modal";
import cn from "classnames";
import type { Dispatch, SetStateAction } from "react";
import type {
  PremiseBookingActor,
  PremiseRecurrenceType,
  PremiseSlotItem,
  PremiseSlotPaymentStatus,
  PremiseSlotStatus,
  PremiseUsageType,
} from "../../../sync/api/premises";
import { parseBookingActorValue } from "../model/premise-detail-forms";
import {
  paymentStatusOptions,
  recurrenceTypeOptions,
  statusOptions,
  usageTypeOptions,
} from "../model/premise-detail-options";
import type {
  RentalScheduleFormDay,
  SlotFormState,
} from "../model/premise-detail-types";

export type PremiseDetailSlotModalProps = {
  isOpen: boolean;
  onClose: () => void;
  editingSlot: PremiseSlotItem | null;
  canManagePremise: boolean;
  slotForm: SlotFormState;
  setSlotForm: Dispatch<SetStateAction<SlotFormState>>;
  bookingActors: PremiseBookingActor[];
  bookingActorOptions: { value: string; label: string }[];
  selectedBookingActorValue: string;
  slotError: string | null;
  creatingRental: boolean;
  updatingSlot: boolean;
  onUpdateRentalScheduleDay: (
    weekday: number,
    patch: Partial<
      Pick<RentalScheduleFormDay, "enabled" | "startsAt" | "endsAt">
    >,
  ) => void;
  onSave: () => void;
};

export function PremiseDetailSlotModal({
  isOpen,
  onClose,
  editingSlot,
  canManagePremise,
  slotForm,
  setSlotForm,
  bookingActors,
  bookingActorOptions,
  selectedBookingActorValue,
  slotError,
  creatingRental,
  updatingSlot,
  onUpdateRentalScheduleDay,
  onSave,
}: PremiseDetailSlotModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={editingSlot ? "Редактирование слота" : "Новый слот"}
      panelClassName="premises-slot-modal"
    >
      <div className="premises-slot-modal__inner">
        <h3 id="premise-slot-modal-title">
          {editingSlot
            ? "Редактировать слот"
            : canManagePremise
              ? "Новый слот"
              : "Заявка на бронь"}
        </h3>
        {!editingSlot ? (
          <FormInlineRow className="premises-form-row">
            <CustomSelect
              value={slotForm.usageType}
              options={usageTypeOptions}
              onChange={(value) =>
                setSlotForm((state) => ({
                  ...state,
                  usageType: value as PremiseUsageType,
                }))
              }
              aria-label="Тип использования помещения"
            />
            <CustomSelect
              value={slotForm.recurrenceType}
              options={recurrenceTypeOptions}
              onChange={(value) =>
                setSlotForm((state) => ({
                  ...state,
                  recurrenceType: value as PremiseRecurrenceType,
                }))
              }
              aria-label="Периодичность"
            />
          </FormInlineRow>
        ) : null}
        {!editingSlot && bookingActorOptions.length > 1 ? (
          <FormInlineRow className="premises-form-row">
            <CustomSelect
              value={selectedBookingActorValue}
              options={bookingActorOptions}
              onChange={(value) => {
                const parsed = parseBookingActorValue(value);
                const matched =
                  bookingActors.find(
                    (actor) =>
                      actor.kind === parsed.kind &&
                      (actor.id ?? "") === parsed.id,
                  ) ?? null;
                setSlotForm((state) => ({
                  ...state,
                  bookedAsKind: parsed.kind,
                  bookedAsId: parsed.id,
                  bookedAsTitle: matched?.title ?? state.bookedAsTitle,
                }));
              }}
              aria-label="От чьего имени бронь"
            />
            {slotForm.bookedAsKind === "external" ? (
              <InlineTextField
                value={slotForm.bookedAsTitle}
                onChange={(event) =>
                  setSlotForm((state) => ({
                    ...state,
                    bookedAsTitle: event.target.value,
                  }))
                }
                placeholder="Название арендатора"
                aria-label="Название внешнего арендатора"
              />
            ) : null}
          </FormInlineRow>
        ) : null}
        {!editingSlot && !canManagePremise ? (
          <p className="rehearsals-muted premises-slot-modal__hint">
            {bookingActorOptions.length > 1
              ? "Заявку можно подать от своего имени или от организации, которой вы владеете или администрируете. Она уйдёт на подтверждение хозяину помещения."
              : "Заявка уйдёт на подтверждение хозяину или администратору помещения."}
          </p>
        ) : null}
        {editingSlot || slotForm.recurrenceType === "once" ? (
          <FormInlineRow className="premises-form-row">
            <label className="premises-field">
              <span>Начало</span>
              <input
                type="datetime-local"
                value={slotForm.startsAtLocal}
                onChange={(e) =>
                  setSlotForm((state) => ({
                    ...state,
                    startsAtLocal: e.target.value,
                  }))
                }
              />
            </label>
            <InlineTextField
              value={slotForm.durationMin}
              onChange={(e) =>
                setSlotForm((state) => ({
                  ...state,
                  durationMin: e.target.value,
                }))
              }
              inputMode="numeric"
              placeholder="Минут"
              aria-label="Длительность в минутах"
            />
          </FormInlineRow>
        ) : (
          <div className="premises-rental-schedule">
            <FormInlineRow className="premises-form-row">
              <label className="premises-field">
                <span>Начало аренды</span>
                <InlineTextField
                  type="date"
                  className="premises-date-input"
                  value={slotForm.periodStartsOn}
                  onChange={(event) =>
                    setSlotForm((state) => ({
                      ...state,
                      periodStartsOn: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="premises-field">
                <span>Окончание аренды</span>
                <InlineTextField
                  type="date"
                  className="premises-date-input"
                  value={slotForm.periodEndsOn}
                  disabled={slotForm.indefinite}
                  onChange={(event) =>
                    setSlotForm((state) => ({
                      ...state,
                      periodEndsOn: event.target.value,
                    }))
                  }
                />
              </label>
            </FormInlineRow>
            <label className="premises-checkbox premises-rental-schedule__indefinite">
              <input
                type="checkbox"
                checked={slotForm.indefinite}
                onChange={(event) =>
                  setSlotForm((state) => ({
                    ...state,
                    indefinite: event.target.checked,
                  }))
                }
              />
              Бессрочная аренда
            </label>
            <div className="premises-rental-schedule__days">
              {slotForm.schedules.map((day) => (
                <div
                  key={day.weekday}
                  className={cn(
                    "premises-rental-schedule__day",
                    !day.enabled && "premises-rental-schedule__day--disabled",
                  )}
                >
                  <label className="premises-checkbox">
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={(event) =>
                        onUpdateRentalScheduleDay(day.weekday, {
                          enabled: event.target.checked,
                        })
                      }
                    />
                    {day.label}
                  </label>
                  {day.enabled ? (
                    <div className="premises-rental-schedule__time">
                      <input
                        type="time"
                        value={day.startsAt}
                        onChange={(event) =>
                          onUpdateRentalScheduleDay(day.weekday, {
                            startsAt: event.target.value,
                          })
                        }
                        aria-label={`Начало, ${day.label}`}
                      />
                      <input
                        type="time"
                        value={day.endsAt}
                        onChange={(event) =>
                          onUpdateRentalScheduleDay(day.weekday, {
                            endsAt: event.target.value,
                          })
                        }
                        aria-label={`Окончание, ${day.label}`}
                      />
                    </div>
                  ) : (
                    <span className="rehearsals-muted">Не арендуется</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <InlineTextField
          value={slotForm.title}
          onChange={(e) =>
            setSlotForm((s) => ({ ...s, title: e.target.value }))
          }
          placeholder="Название слота"
          maxLength={140}
          aria-label="Название"
        />
        <FormTextarea
          label="Для чего арендуем / что будем делать"
          value={slotForm.purpose}
          onChange={(e) =>
            setSlotForm((s) => ({ ...s, purpose: e.target.value }))
          }
          rows={3}
        />
        <FormTextarea
          label="Условия аренды и договорённости"
          value={slotForm.rentalNotes}
          onChange={(e) =>
            setSlotForm((s) => ({ ...s, rentalNotes: e.target.value }))
          }
          rows={3}
        />
        {slotForm.usageType === "commercial" || editingSlot ? (
          <div className="premises-slot-payment">
            <div className="premises-slot-payment__title">Оплата аренды</div>
            <FormInlineRow className="premises-form-row">
              <InlineTextField
                value={slotForm.rentalAmountRub}
                onChange={(e) =>
                  setSlotForm((state) => ({
                    ...state,
                    rentalAmountRub: e.target.value,
                  }))
                }
                inputMode="numeric"
                placeholder={
                  slotForm.recurrenceType === "weekly"
                    ? "Сумма в месяц, ₽"
                    : "Сумма, ₽"
                }
                aria-label="Сумма аренды в рублях"
              />
              {slotForm.recurrenceType === "weekly" && !editingSlot ? (
                <InlineTextField
                  value={slotForm.paymentDueDay}
                  onChange={(event) =>
                    setSlotForm((state) => ({
                      ...state,
                      paymentDueDay: event.target.value,
                    }))
                  }
                  inputMode="numeric"
                  placeholder="Оплата до числа"
                  aria-label="День ежемесячной оплаты"
                />
              ) : null}
              {canManagePremise && editingSlot ? (
                <CustomSelect
                  value={slotForm.paymentStatus}
                  options={paymentStatusOptions}
                  onChange={(value) =>
                    setSlotForm((state) => ({
                      ...state,
                      paymentStatus: value as PremiseSlotPaymentStatus,
                    }))
                  }
                  aria-label="Статус оплаты"
                />
              ) : null}
            </FormInlineRow>
          </div>
        ) : null}
        <FormInlineRow className="premises-form-row">
          <InlineTextField
            value={slotForm.contactName}
            onChange={(e) =>
              setSlotForm((s) => ({ ...s, contactName: e.target.value }))
            }
            placeholder="Имя контакта"
            aria-label="Имя контакта"
          />
          <InlineTextField
            value={slotForm.contactEmail}
            onChange={(e) =>
              setSlotForm((s) => ({ ...s, contactEmail: e.target.value }))
            }
            placeholder="Email контакта"
            inputMode="email"
            aria-label="Email контакта"
          />
          <InlineTextField
            value={slotForm.contactPhone}
            onChange={(e) =>
              setSlotForm((state) => ({
                ...state,
                contactPhone: e.target.value,
              }))
            }
            placeholder="Телефон"
            inputMode="tel"
            autoComplete="tel"
            maxLength={40}
            aria-label="Телефон контакта"
          />
        </FormInlineRow>
        {canManagePremise && editingSlot ? (
          <CustomSelect
            value={slotForm.status}
            options={statusOptions}
            onChange={(v) =>
              setSlotForm((s) => ({ ...s, status: v as PremiseSlotStatus }))
            }
            aria-label="Статус"
          />
        ) : null}
        {slotError ? <div className="premises-error">{slotError}</div> : null}
        <div className="premises-slot-modal__actions">
          <Button type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={creatingRental || updatingSlot}
            onClick={() => void onSave()}
          >
            {creatingRental || updatingSlot
              ? "Сохранение…"
              : editingSlot
                ? "Сохранить"
                : canManagePremise
                  ? "Сохранить"
                  : "Отправить заявку"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
