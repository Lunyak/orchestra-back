import {
  CalendarSection,
  type CalendarSectionState,
} from "@shared/components/calendar/CalendarSection";
import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { Modal } from "@shared/core/modal/Modal";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import { useAuth } from "../../features/auth";
import { useMyProfileQuery } from "../../features/profile/api/profile-api";
import {
  formatSlotTime,
  fromDatetimeLocalValue,
  isoDate,
  monthRangeIso,
  premiseKindLabel,
  premiseMemberRoleLabel,
  slotDotsByDate,
  slotsForDay,
  slotStatusLabel,
  toDatetimeLocalValue,
  useAddPremiseMemberMutation,
  useCreatePremiseSlotMutation,
  useDeletePremiseSlotMutation,
  useGetPremiseQuery,
  useListPremiseMembersQuery,
  useListPremiseSlotsQuery,
  useRemovePremiseMemberMutation,
  useUpdatePremiseMemberMutation,
  useUpdatePremiseSlotMutation,
} from "../../features/premises";
import type {
  PremiseMemberRole,
  PremiseSlotItem,
  PremiseSlotStatus,
} from "../../sync/api/premises";
import "../../pages/rehearsals/style.css";
import "../../pages/sessions/style.css";
import "./style.css";

dayjs.locale("ru");

const roleOptions: { value: PremiseMemberRole; label: string }[] = [
  { value: "viewer", label: premiseMemberRoleLabel("viewer") },
  { value: "tenant", label: premiseMemberRoleLabel("tenant") },
  { value: "manager", label: premiseMemberRoleLabel("manager") },
  { value: "owner", label: premiseMemberRoleLabel("owner") },
];

const statusOptions: { value: PremiseSlotStatus; label: string }[] = [
  { value: "confirmed", label: slotStatusLabel("confirmed") },
  { value: "pending", label: slotStatusLabel("pending") },
  { value: "cancelled", label: slotStatusLabel("cancelled") },
];

type SlotFormState = {
  startsAtLocal: string;
  durationMin: string;
  title: string;
  purpose: string;
  rentalNotes: string;
  contactEmail: string;
  contactName: string;
  status: PremiseSlotStatus;
};

function emptySlotForm(dayIso: string): SlotFormState {
  const base = dayjs(dayIso).hour(10).minute(0).second(0).millisecond(0);
  return {
    startsAtLocal: base.format("YYYY-MM-DDTHH:mm"),
    durationMin: "120",
    title: "",
    purpose: "",
    rentalNotes: "",
    contactEmail: "",
    contactName: "",
    status: "confirmed",
  };
}

function slotToForm(slot: PremiseSlotItem): SlotFormState {
  return {
    startsAtLocal: toDatetimeLocalValue(slot.startsAt),
    durationMin: String(slot.durationMin),
    title: slot.title,
    purpose: slot.purpose ?? "",
    rentalNotes: slot.rentalNotes ?? "",
    contactEmail: slot.contactEmail ?? "",
    contactName: slot.contactName ?? "",
    status: slot.status,
  };
}

function slotTimeShort(slot: PremiseSlotItem): string {
  const start = dayjs(slot.startsAt);
  const end = start.add(slot.durationMin, "minute");
  return `${start.format("HH:mm")} – ${end.format("HH:mm")}`;
}

function extractError(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "data" in e) {
    const msg = (e as { data?: { message?: string } }).data?.message;
    if (msg) return String(msg);
  }
  return fallback;
}

export function PremiseDetailPage() {
  const { premiseId = "" } = useParams<{ premiseId: string }>();
  const { accessToken } = useAuth();
  const { data: myProfile } = useMyProfileQuery(undefined, {
    skip: !accessToken,
  });
  const userEmail = myProfile?.email ?? "";

  const [calendarState, setCalendarState] =
    useState<CalendarSectionState | null>(null);
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<PremiseSlotItem | null>(null);
  const [slotForm, setSlotForm] = useState<SlotFormState>(() =>
    emptySlotForm(isoDate(new Date())),
  );
  const [slotError, setSlotError] = useState<string | null>(null);

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<PremiseMemberRole>("tenant");
  const [memberCanBook, setMemberCanBook] = useState(true);
  const [memberError, setMemberError] = useState<string | null>(null);

  const range = useMemo(
    () =>
      calendarState
        ? { from: calendarState.fromIso, to: calendarState.toIso }
        : monthRangeIso(new Date()),
    [calendarState],
  );
  const selectedDate = calendarState?.selectedDate ?? isoDate(new Date());
  const calendarSelectedDateLabel = dayjs(selectedDate).format("D MMMM YYYY");

  const {
    data: premise,
    isLoading: premiseLoading,
    error: premiseError,
  } = useGetPremiseQuery(premiseId, { skip: !accessToken || !premiseId });

  const { data: slotsData, isFetching: slotsFetching } =
    useListPremiseSlotsQuery(
      { premiseId, from: range.from, to: range.to },
      { skip: !accessToken || !premiseId },
    );

  const { data: membersData } = useListPremiseMembersQuery(premiseId, {
    skip: !accessToken || !premiseId || !premise?.canManage,
  });

  const [createSlot, { isLoading: creatingSlot }] =
    useCreatePremiseSlotMutation();
  const [updateSlot, { isLoading: updatingSlot }] =
    useUpdatePremiseSlotMutation();
  const [deleteSlot] = useDeletePremiseSlotMutation();
  const [addMember, { isLoading: addingMember }] =
    useAddPremiseMemberMutation();
  const [updateMember] = useUpdatePremiseMemberMutation();
  const [removeMember] = useRemovePremiseMemberMutation();

  const slots = slotsData?.slots ?? [];
  const daySlots = useMemo(
    () => slotsForDay(slots, selectedDate),
    [slots, selectedDate],
  );
  const dots = useMemo(() => slotDotsByDate(slots), [slots]);

  if (!accessToken) {
    return (
      <div className="rehearsals-page sessions-page">
        <div className="rehearsals-muted">Нужно войти.</div>
      </div>
    );
  }

  if (premiseLoading) {
    return (
      <div className="app-layout premises-layout">
        <div className="app-content">
          <main className="main-content main-content-premises">
            <div className="rehearsals-page sessions-page">
              <div className="rehearsals-muted">Загрузка…</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (premiseError || !premise) {
    return (
      <div className="app-layout premises-layout">
        <div className="app-content">
          <main className="main-content main-content-premises">
            <div className="rehearsals-page sessions-page">
              <div className="rehearsals-error">
                Помещение не найдено или нет доступа
              </div>
              <Link to="/premises" className="director-session-page__back">
                ← Все помещения
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  function openCreateSlot() {
    setEditingSlot(null);
    setSlotForm(emptySlotForm(selectedDate));
    setSlotError(null);
    setSlotModalOpen(true);
  }

  function openEditSlot(slot: PremiseSlotItem) {
    setEditingSlot(slot);
    setSlotForm(slotToForm(slot));
    setSlotError(null);
    setSlotModalOpen(true);
  }

  async function saveSlot() {
    const durationMin = Number(slotForm.durationMin);
    if (
      !slotForm.title.trim() ||
      !Number.isFinite(durationMin) ||
      durationMin < 1
    ) {
      setSlotError("Заполните название и длительность");
      return;
    }
    setSlotError(null);
    const body = {
      startsAt: fromDatetimeLocalValue(slotForm.startsAtLocal),
      durationMin,
      title: slotForm.title.trim(),
      purpose: slotForm.purpose.trim() || undefined,
      rentalNotes: slotForm.rentalNotes.trim() || undefined,
      contactEmail: slotForm.contactEmail.trim() || undefined,
      contactName: slotForm.contactName.trim() || undefined,
      status: slotForm.status,
    };
    try {
      if (editingSlot) {
        await updateSlot({
          premiseId,
          slotId: editingSlot.id,
          body,
        }).unwrap();
      } else {
        await createSlot({ premiseId, body }).unwrap();
      }
      setSlotModalOpen(false);
    } catch (e: unknown) {
      setSlotError(extractError(e, "Не удалось сохранить слот"));
    }
  }

  async function handleDeleteSlot(slot: PremiseSlotItem) {
    if (!confirm(`Удалить слот «${slot.title}»?`)) return;
    try {
      await deleteSlot({ premiseId, slotId: slot.id }).unwrap();
    } catch {
      // ignore
    }
  }

  async function handleAddMember() {
    const email = memberEmail.trim();
    if (!email) return;
    setMemberError(null);
    try {
      await addMember({
        premiseId,
        body: { email, role: memberRole, canBook: memberCanBook },
      }).unwrap();
      setMemberEmail("");
    } catch (e: unknown) {
      setMemberError(extractError(e, "Не удалось добавить участника"));
    }
  }

  function canEditSlot(slot: PremiseSlotItem): boolean {
    if (!premise) return false;
    if (premise.canManage) return true;
    if (!premise.canBook) return false;
    const me = userEmail.trim().toLowerCase();
    return (
      slot.createdByEmail.trim().toLowerCase() === me ||
      (slot.contactEmail?.trim().toLowerCase() ?? "") === me
    );
  }

  return (
    <div className="app-layout premises-layout">
      <div className="app-content">
        <main className="main-content main-content-premises">
          <div className="rehearsals-page sessions-page">
            <div className="rehearsals-head premises-page__head">
              <div className="premises-page__head-main">
                <div className="premises-page__title-row">
                  <div className="rehearsals-meta">{premise.name}</div>
                  <span
                    className={cn(
                      "premises-page__kind",
                      premise.kind === "OWNED"
                        ? "premises-page__kind--owned"
                        : "premises-page__kind--rented",
                    )}
                  >
                    {premiseKindLabel(premise.kind)}
                  </span>
                </div>
                {(premise.address || premise.notes) && (
                  <p className="rehearsals-muted premises-page__subtitle">
                    {[premise.address, premise.notes].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="premises-page__head-actions">
                <Link to="/premises" className="director-session-page__back">
                  ← Все помещения
                </Link>
              </div>
            </div>

            <div className="sessions-layout">
              <aside className="sessions-side">
                <RehearsalsCard className="sessions-calendar-card">
                  {premise.canBook ? (
                    <div className="sessions-calendar-toolbar">
                      <Button
                        type="button"
                        onClick={openCreateSlot}
                        title={`Добавить слот на ${calendarSelectedDateLabel}`}
                      >
                        + Слот на день
                      </Button>
                    </div>
                  ) : null}

                  <CalendarSection
                    className="sessions-calendar"
                    storageMonthKey={`premise-${premiseId}-calendar-month`}
                    onStateChange={setCalendarState}
                    dotsByDate={dots}
                    onDayDoubleClick={() => {
                      if (premise.canBook) openCreateSlot();
                    }}
                    title="Занятость"
                    subtitle="Клик — выбрать день · двойной клик — новый слот"
                    showStatusMarks={false}
                  />

                  {slotsFetching ? (
                    <p className="rehearsals-muted premises-calendar-fetching">
                      Обновление слотов…
                    </p>
                  ) : null}

                  <div className="sessions-day-panel">
                    <div className="sessions-day-panel__head">
                      <span className="sessions-day-panel__title">
                        {calendarSelectedDateLabel}
                      </span>
                      <span className="rehearsals-muted sessions-day-panel__count">
                        {daySlots.length
                          ? `${daySlots.length} сл.`
                          : "нет слотов"}
                      </span>
                    </div>

                    <div className="sessions-day-list">
                      {daySlots.length === 0 ? (
                        <div className="rehearsals-muted sessions-day-list__empty">
                          На этот день броней нет.
                          {premise.canBook
                            ? " Нажмите «+ Слот на день» или сделайте двойной клик по дате."
                            : null}
                        </div>
                      ) : (
                        daySlots.map((slot) => (
                          <div key={slot.id} className="sessions-day-item">
                            <button
                              type="button"
                              className="sessions-day-item__main"
                              onClick={() => openEditSlot(slot)}
                              disabled={!canEditSlot(slot)}
                              title={
                                canEditSlot(slot)
                                  ? "Открыть слот"
                                  : "Только просмотр"
                              }
                            >
                              <span className="sessions-day-item__time">
                                {slotTimeShort(slot)}
                              </span>
                              <span className="sessions-day-item__title">
                                {slot.title}
                              </span>
                              <span
                                className={cn(
                                  "sessions-day-item__badge",
                                  slot.status === "confirmed" &&
                                    "premises-day-item__badge--confirmed",
                                  slot.status === "cancelled" &&
                                    "premises-day-item__badge--cancelled",
                                )}
                              >
                                {slotStatusLabel(slot.status)}
                              </span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </RehearsalsCard>
              </aside>

              <div className="sessions-main">
                <RehearsalsCard fluid>
                  <div className="sessions-slots-readonly">
                    <div className="sessions-slots-readonly__head">
                      <span className="rehearsals-section-title">
                        Слоты на {calendarSelectedDateLabel}
                      </span>
                      {premise.canBook ? (
                        <Button type="button" onClick={openCreateSlot}>
                          Добавить слот
                        </Button>
                      ) : null}
                    </div>

                    {daySlots.length === 0 ? (
                      <div className="sessions-slots-empty rehearsals-muted">
                        На этот день броней нет
                      </div>
                    ) : (
                      daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="sessions-slots-readonly__row"
                        >
                          <div className="sessions-slots-readonly__time">
                            {formatSlotTime(slot)}
                          </div>
                          <div className="sessions-slots-readonly__meta">
                            <strong>{slot.title}</strong>
                            {" · "}
                            {slotStatusLabel(slot.status)}
                          </div>
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
                          {slot.contactEmail || slot.contactName ? (
                            <div className="sessions-slots-readonly__notes">
                              <b>Контакт:</b>{" "}
                              {[slot.contactName, slot.contactEmail]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          ) : null}
                          {canEditSlot(slot) ? (
                            <div className="premises-slot-row__actions">
                              <Button
                                type="button"
                                onClick={() => openEditSlot(slot)}
                              >
                                Изменить
                              </Button>
                              <Button
                                type="button"
                                className="danger"
                                onClick={() => void handleDeleteSlot(slot)}
                              >
                                Удалить
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </RehearsalsCard>

                {premise.canManage ? (
                  <RehearsalsCard fluid className="premises-members-card">
                    <div className="rehearsals-card-title">
                      Участники помещения
                    </div>
                    <p className="rehearsals-muted">
                      Любой email — арендаторы смогут бронировать слоты, если
                      включено «может бронировать».
                    </p>
                    <FormInlineRow className="premises-form-row">
                      <InlineTextField
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                        placeholder="email@example.com"
                        inputMode="email"
                        autoComplete="email"
                        aria-label="Email участника"
                      />
                      <CustomSelect
                        value={memberRole}
                        options={roleOptions}
                        onChange={(v) => setMemberRole(v as PremiseMemberRole)}
                        aria-label="Роль"
                      />
                      <label className="premises-checkbox">
                        <input
                          type="checkbox"
                          checked={memberCanBook}
                          onChange={(e) => setMemberCanBook(e.target.checked)}
                        />
                        Может бронировать
                      </label>
                      <Button
                        type="button"
                        disabled={addingMember || !memberEmail.trim()}
                        onClick={() => void handleAddMember()}
                      >
                        {addingMember ? "…" : "Добавить"}
                      </Button>
                    </FormInlineRow>
                    {memberError ? (
                      <div className="rehearsals-error">{memberError}</div>
                    ) : null}

                    <ul className="premises-members-list">
                      {(membersData?.members ?? []).map((m) => (
                        <li key={m.id} className="premises-member-item">
                          <div className="premises-member-item__email">
                            {m.email}
                          </div>
                          <CustomSelect
                            value={m.role}
                            options={roleOptions}
                            onChange={(v) =>
                              void updateMember({
                                premiseId,
                                memberId: m.id,
                                body: { role: v as PremiseMemberRole },
                              })
                            }
                            aria-label={`Роль ${m.email}`}
                          />
                          <label className="premises-checkbox">
                            <input
                              type="checkbox"
                              checked={m.canBook}
                              onChange={(e) =>
                                void updateMember({
                                  premiseId,
                                  memberId: m.id,
                                  body: { canBook: e.target.checked },
                                })
                              }
                            />
                            Бронь
                          </label>
                          <Button
                            type="button"
                            className="danger"
                            onClick={() => {
                              if (!confirm(`Удалить ${m.email}?`)) return;
                              void removeMember({ premiseId, memberId: m.id });
                            }}
                          >
                            Удалить
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </RehearsalsCard>
                ) : null}
              </div>
            </div>
          </div>
        </main>
      </div>

      <Modal
        isOpen={slotModalOpen}
        onClose={() => setSlotModalOpen(false)}
        ariaLabel={editingSlot ? "Редактирование слота" : "Новый слот"}
        panelClassName="premises-slot-modal-panel"
      >
        <div className="premises-slot-modal__inner">
          <h3 id="premise-slot-modal-title">
            {editingSlot ? "Редактировать слот" : "Новый слот"}
          </h3>
          <FormInlineRow className="premises-form-row">
            <label className="premises-field">
              <span>Начало</span>
              <input
                type="datetime-local"
                value={slotForm.startsAtLocal}
                onChange={(e) =>
                  setSlotForm((s) => ({ ...s, startsAtLocal: e.target.value }))
                }
              />
            </label>
            <InlineTextField
              value={slotForm.durationMin}
              onChange={(e) =>
                setSlotForm((s) => ({ ...s, durationMin: e.target.value }))
              }
              inputMode="numeric"
              placeholder="Минут"
              aria-label="Длительность в минутах"
            />
          </FormInlineRow>
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
            label="Условия аренды, сумма, договорённости"
            value={slotForm.rentalNotes}
            onChange={(e) =>
              setSlotForm((s) => ({ ...s, rentalNotes: e.target.value }))
            }
            rows={3}
          />
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
          </FormInlineRow>
          {premise.canManage ? (
            <CustomSelect
              value={slotForm.status}
              options={statusOptions}
              onChange={(v) =>
                setSlotForm((s) => ({ ...s, status: v as PremiseSlotStatus }))
              }
              aria-label="Статус"
            />
          ) : null}
          {slotError ? (
            <div className="premises-error">{slotError}</div>
          ) : null}
          <div className="premises-slot-modal__actions">
            <Button type="button" onClick={() => setSlotModalOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={creatingSlot || updatingSlot}
              onClick={() => void saveSlot()}
            >
              {creatingSlot || updatingSlot ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

