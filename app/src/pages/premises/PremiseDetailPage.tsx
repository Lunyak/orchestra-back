import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { Modal } from "@shared/core/modal/Modal";
import { MonthCalendar } from "@shared/components/calendar/MonthCalendar";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../features/auth";
import { useMyProfileQuery } from "../../features/profile/api/profile-api";
import {
  formatSlotTime,
  fromDatetimeLocalValue,
  isoDate,
  monthKey,
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

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
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

  const range = useMemo(() => monthRangeIso(currentMonth), [currentMonth]);

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
    return <div>Нужно войти.</div>;
  }

  if (premiseLoading) {
    return <div className="premises-layout">Загрузка…</div>;
  }

  if (premiseError || !premise) {
    return (
      <div className="premises-layout">
        <div className="premises-error">
          Помещение не найдено или нет доступа
        </div>
        <Link to="/premises" className="premises-link-back">
          ← Все помещения
        </Link>
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
        <main className="main-content">
          <div className="premises-view">
            <div className="premises-header">
              <div>
                <h2 className="premises-header__title">{premise.name}</h2>
                <p className="premises-header__subtitle">
                  <span
                    className={cn(
                      "premises-list-item__kind",
                      premise.kind === "OWNED"
                        ? "premises-list-item__kind--owned"
                        : "premises-list-item__kind--rented",
                    )}
                  >
                    {premiseKindLabel(premise.kind)}
                  </span>
                  {premise.address ? ` · ${premise.address}` : null}
                  {premise.notes ? (
                    <span className="premises-detail-notes">
                      {" "}
                      · {premise.notes}
                    </span>
                  ) : null}
                </p>
              </div>
              <Link to="/premises" className="premises-link-back">
                ← Все помещения
              </Link>
            </div>

            <div className="premises-detail-grid">
              <div className="premises-card premises-calendar-card">
                <MonthCalendar
                  currentMonth={currentMonth}
                  selectedDate={selectedDate}
                  onChangeMonth={setCurrentMonth}
                  onSelectDate={setSelectedDate}
                  dotsByDate={dots}
                  title="Занятость"
                  subtitle={`Месяц: ${monthKey(currentMonth)}`}
                />
                {slotsFetching ? (
                  <p className="premises-hint">Обновление слотов…</p>
                ) : null}
              </div>

              <div className="premises-card premises-slots-card">
                <div className="premises-slots-card__head">
                  <div className="premises-card__title">
                    Слоты на {dayjs(selectedDate).format("D MMMM YYYY")}
                  </div>
                  {premise.canBook ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={openCreateSlot}
                    >
                      Добавить слот
                    </Button>
                  ) : null}
                </div>

                {daySlots.length === 0 ? (
                  <p className="premises-hint">На этот день броней нет</p>
                ) : (
                  <ul className="premises-slots-list">
                    {daySlots.map((slot) => (
                      <li key={slot.id} className="premises-slot-item">
                        <div className="premises-slot-item__head">
                          <span className="premises-slot-item__title">
                            {slot.title}
                          </span>
                          <span
                            className={cn(
                              "premises-slot-item__status",
                              `premises-slot-item__status--${slot.status}`,
                            )}
                          >
                            {slotStatusLabel(slot.status)}
                          </span>
                        </div>
                        <div className="premises-slot-item__time">
                          {formatSlotTime(slot)}
                        </div>
                        {slot.purpose ? (
                          <div className="premises-slot-item__field">
                            <b>Для чего:</b> {slot.purpose}
                          </div>
                        ) : null}
                        {slot.rentalNotes ? (
                          <div className="premises-slot-item__field">
                            <b>Аренда:</b> {slot.rentalNotes}
                          </div>
                        ) : null}
                        {slot.contactEmail || slot.contactName ? (
                          <div className="premises-slot-item__field">
                            <b>Контакт:</b>{" "}
                            {[slot.contactName, slot.contactEmail]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        ) : null}
                        {canEditSlot(slot) ? (
                          <div className="premises-slot-item__actions">
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
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {premise.canManage ? (
              <div className="premises-card">
                <div className="premises-card__title">Участники помещения</div>
                <p className="premises-hint">
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
                    variant="primary"
                    disabled={addingMember || !memberEmail.trim()}
                    onClick={() => void handleAddMember()}
                  >
                    {addingMember ? "…" : "Добавить"}
                  </Button>
                </FormInlineRow>
                {memberError ? (
                  <div className="premises-error">{memberError}</div>
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
              </div>
            ) : null}
          </div>
        </main>
      </div>

      <Modal
        isOpen={slotModalOpen}
         onClose={() => setSlotModalOpen(false)}
        ariaLabel={editingSlot ? "Редактирование слота" : "Новый слот"}
        panelClassName="premises-slot-modal"
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
              variant="primary"
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

