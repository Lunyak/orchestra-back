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
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  globalPaths,
  studioPremisesPath,
  theaterPremisesPath,
} from "../../app/router/paths";
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
  useDeletePremiseMutation,
  useDeletePremiseSlotMutation,
  useGetPremiseQuery,
  useListPremiseMembersQuery,
  useListPremiseSlotsQuery,
  useRemovePremiseMemberMutation,
  useUpdatePremiseMutation,
  useUpdatePremiseMemberMutation,
  useUpdatePremiseSlotMutation,
} from "../../features/premises";
import type {
  CreatePremiseSlotPayload,
  PremiseKind,
  PremiseMemberRole,
  PremiseSlotPaymentStatus,
  PremiseSlotItem,
  PremiseSlotStatus,
  UpdatePremiseSlotPayload,
} from "../../sync/api/premises";
import "../../features/rehearsals/ui/rehearsals.css";
import "../../features/director-sessions/ui/director-sessions.css";
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

const paymentStatusOptions: {
  value: PremiseSlotPaymentStatus;
  label: string;
}[] = [
  { value: "unpaid", label: "Не оплачено" },
  { value: "paid", label: "Оплачено" },
  { value: "waived", label: "Без оплаты" },
];

const premiseKindOptions: { value: PremiseKind; label: string }[] = [
  { value: "OWNED", label: premiseKindLabel("OWNED") },
  { value: "RENTED", label: premiseKindLabel("RENTED") },
];

type PremiseTab = "overview" | "schedule" | "members" | "settings";

type SlotFormState = {
  startsAtLocal: string;
  durationMin: string;
  title: string;
  purpose: string;
  rentalNotes: string;
  rentalAmountRub: string;
  paymentStatus: PremiseSlotPaymentStatus;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
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
    rentalAmountRub: "",
    paymentStatus: "unpaid",
    contactEmail: "",
    contactName: "",
    contactPhone: "",
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
    rentalAmountRub:
      slot.rentalAmountRub == null ? "" : String(slot.rentalAmountRub),
    paymentStatus: slot.paymentStatus,
    contactEmail: slot.contactEmail ?? "",
    contactName: slot.contactName ?? "",
    contactPhone: slot.contactPhone ?? "",
    status: slot.status,
  };
}

function paymentStatusLabel(status: PremiseSlotPaymentStatus): string {
  return (
    paymentStatusOptions.find((option) => option.value === status)?.label ??
    status
  );
}

function formatRubles(amountRub: number): string {
  return `${amountRub.toLocaleString("ru-RU")} ₽`;
}

type SlotContactItem = {
  type: "name" | "phone" | "email";
  value: string;
};

function getSlotContactItems(slot: PremiseSlotItem): SlotContactItem[] {
  const candidates: SlotContactItem[] = [
    { type: "name", value: slot.contactName?.trim() ?? "" },
    { type: "phone", value: slot.contactPhone?.trim() ?? "" },
    { type: "email", value: slot.contactEmail?.trim() ?? "" },
  ];
  const seenValues = new Set<string>();

  return candidates.filter((item) => {
    const normalizedValue = item.value.toLocaleLowerCase("ru-RU");
    if (!normalizedValue || seenValues.has(normalizedValue)) return false;
    seenValues.add(normalizedValue);
    return true;
  });
}

function PremiseSlotContact({ slot }: { slot: PremiseSlotItem }) {
  const contactItems = getSlotContactItems(slot);
  if (contactItems.length === 0) return null;

  return (
    <div className="sessions-slots-readonly__notes">
      <b>Контакт:</b>
      <span className="premises-slot-contact">
        {contactItems.map((item) => (
          <span
            key={`${item.type}-${item.value}`}
            className={cn(
              "premises-slot-contact__item",
              item.type === "phone" && "premises-slot-contact__item--phone",
            )}
          >
            {item.value}
          </span>
        ))}
      </span>
    </div>
  );
}

function extractError(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "data" in e) {
    const msg = (e as { data?: { message?: string } }).data?.message;
    if (msg) return String(msg);
  }
  return fallback;
}

export function PremiseDetailPage() {
  const navigate = useNavigate();
  const {
    premiseId = "",
    theaterId = "",
    studioId = "",
  } = useParams<{
    premiseId: string;
    theaterId?: string;
    studioId?: string;
  }>();
  const premisesPath = theaterId
    ? theaterPremisesPath(theaterId)
    : studioId
      ? studioPremisesPath(studioId)
      : globalPaths.premises;
  const { accessToken } = useAuth();
  const { data: myProfile } = useMyProfileQuery(undefined, {
    skip: !accessToken,
  });
  const userEmail = myProfile?.email ?? "";

  const [activeTab, setActiveTab] = useState<PremiseTab>("overview");
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
  const [settingsName, setSettingsName] = useState("");
  const [settingsKind, setSettingsKind] = useState<PremiseKind>("OWNED");
  const [settingsAddress, setSettingsAddress] = useState("");
  const [settingsCapacity, setSettingsCapacity] = useState("");
  const [settingsPaymentDueDay, setSettingsPaymentDueDay] = useState("");
  const [settingsNotes, setSettingsNotes] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);

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
  const [updatePremise, { isLoading: updatingPremise }] =
    useUpdatePremiseMutation();
  const [deletePremise, { isLoading: deletingPremise }] =
    useDeletePremiseMutation();
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
  const activeSlots = useMemo(
    () => slots.filter((slot) => slot.status !== "cancelled"),
    [slots],
  );
  const pendingSlots = useMemo(
    () => slots.filter((slot) => slot.status === "pending"),
    [slots],
  );
  const trackedSlots = useMemo(() => {
    const todayStart = dayjs().startOf("day");
    return activeSlots
      .filter((slot) => !dayjs(slot.startsAt).isBefore(todayStart))
      .slice(0, 5);
  }, [activeSlots]);
  const todaySlots = useMemo(
    () =>
      activeSlots.filter((slot) => dayjs(slot.startsAt).isSame(dayjs(), "day")),
    [activeSlots],
  );
  const occupiedHours = activeSlots.reduce(
    (total, slot) => total + slot.durationMin / 60,
    0,
  );
  const occupiedDays = new Set(
    activeSlots.map((slot) => dayjs(slot.startsAt).format("YYYY-MM-DD")),
  ).size;
  const unpaidAmountRub = activeSlots.reduce(
    (total, slot) =>
      slot.paymentStatus === "unpaid"
        ? total + (slot.rentalAmountRub ?? 0)
        : total,
    0,
  );
  const canManagePremise = premise?.canManage ?? false;

  useEffect(() => {
    if (!premise) return;
    setSettingsName(premise.name);
    setSettingsKind(premise.kind);
    setSettingsAddress(premise.address ?? "");
    setSettingsCapacity(
      premise.capacity == null ? "" : String(premise.capacity),
    );
    setSettingsPaymentDueDay(
      premise.paymentDueDay == null ? "" : String(premise.paymentDueDay),
    );
    setSettingsNotes(premise.notes ?? "");
  }, [premise]);

  if (!accessToken) {
    return (
      <div className="app-layout premises-layout">
        <div className="app-content">
          <main className="main-content main-content-premises">
            <div className="premises-view">
              <div className="rehearsals-muted">Нужно войти.</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (premiseLoading) {
    return (
      <div className="app-layout premises-layout">
        <div className="app-content">
          <main className="main-content main-content-premises">
            <div className="premises-view">
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
            <div className="premises-view">
              <div className="rehearsals-error">
                Помещение не найдено или нет доступа
              </div>
              <Link to={premisesPath} className="director-session-page__back">
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
    const rentalAmountRub = slotForm.rentalAmountRub
      ? Number(slotForm.rentalAmountRub)
      : null;
    if (
      !slotForm.title.trim() ||
      !Number.isFinite(durationMin) ||
      durationMin < 1 ||
      (rentalAmountRub != null &&
        (!Number.isInteger(rentalAmountRub) || rentalAmountRub < 0))
    ) {
      setSlotError("Проверьте название, длительность и сумму аренды");
      return;
    }
    setSlotError(null);
    const body: CreatePremiseSlotPayload = {
      startsAt: fromDatetimeLocalValue(slotForm.startsAtLocal),
      durationMin,
      title: slotForm.title.trim(),
      purpose: slotForm.purpose.trim() || undefined,
      rentalNotes: slotForm.rentalNotes.trim() || undefined,
      contactEmail: slotForm.contactEmail.trim() || undefined,
      contactName: slotForm.contactName.trim() || undefined,
      contactPhone: slotForm.contactPhone.trim() || undefined,
      status: slotForm.status,
      ...(canManagePremise
        ? {
            rentalAmountRub: rentalAmountRub ?? undefined,
            paymentStatus: slotForm.paymentStatus,
          }
        : {}),
    };
    try {
      if (editingSlot) {
        const updateBody: UpdatePremiseSlotPayload = {
          ...body,
          ...(canManagePremise
            ? {
                rentalAmountRub,
              }
            : {}),
        };
        await updateSlot({
          premiseId,
          slotId: editingSlot.id,
          body: updateBody,
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

  async function handleSaveSettings() {
    const name = settingsName.trim();
    const capacity = settingsCapacity ? Number(settingsCapacity) : null;
    const paymentDueDay = settingsPaymentDueDay
      ? Number(settingsPaymentDueDay)
      : null;
    if (
      !name ||
      (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) ||
      (paymentDueDay != null &&
        (!Number.isInteger(paymentDueDay) ||
          paymentDueDay < 1 ||
          paymentDueDay > 31))
    ) {
      setSettingsError("Проверьте название, вместимость и день оплаты");
      return;
    }
    setSettingsError(null);
    try {
      await updatePremise({
        id: premiseId,
        body: {
          name,
          kind: settingsKind,
          address: settingsAddress.trim() || null,
          capacity,
          paymentDueDay,
          notes: settingsNotes.trim() || null,
        },
      }).unwrap();
    } catch (e: unknown) {
      setSettingsError(extractError(e, "Не удалось сохранить помещение"));
    }
  }

  async function handleDeletePremise() {
    if (!premise) return;
    if (!confirm(`Удалить помещение «${premise.name}» и все его брони?`)) {
      return;
    }
    try {
      await deletePremise(premiseId).unwrap();
      navigate(premisesPath);
    } catch (e: unknown) {
      setSettingsError(extractError(e, "Не удалось удалить помещение"));
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
          <div className="premises-view">
            <div className="rehearsals-page sessions-page">
              <div className="rehearsals-head premises-page__header">
                <div className="premises-page__header-main">
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
                      {[premise.address, premise.notes]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="premises-page__header-actions">
                  <Link
                    to={premisesPath}
                    className="director-session-page__back"
                  >
                    ← Все помещения
                  </Link>
                </div>
              </div>

              <div
                className="premises-tabs"
                role="tablist"
                aria-label="Разделы помещения"
              >
                {(
                  [
                    ["overview", "Обзор"],
                    ["schedule", "Расписание"],
                    ["members", "Участники"],
                    ["settings", "Настройки"],
                  ] as const
                ).map(([tab, label]) => {
                  if (
                    (tab === "members" || tab === "settings") &&
                    !premise.canManage
                  ) {
                    return null;
                  }
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      className={cn(
                        "premises-tabs__button",
                        isActive && "premises-tabs__button--active",
                      )}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(tab)}
                    >
                      {label}
                      {tab === "members" && membersData?.members.length
                        ? ` ${membersData.members.length}`
                        : null}
                    </button>
                  );
                })}
              </div>

              {activeTab === "overview" ? (
                <div className="premises-overview">
                  <div className="premises-overview__metrics">
                    <RehearsalsCard className="premises-metric">
                      <span className="premises-metric__label">
                        Брони сегодня
                      </span>
                      <strong className="premises-metric__value">
                        {todaySlots.length}
                      </strong>
                      <span className="premises-metric__detail">
                        {todaySlots.length
                          ? "остаются видимыми весь день"
                          : "на сегодня броней нет"}
                      </span>
                    </RehearsalsCard>
                    <RehearsalsCard className="premises-metric">
                      <span className="premises-metric__label">
                        Ожидают подтверждения
                      </span>
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
                      <span className="premises-metric__detail">
                        {premise.paymentDueDay
                          ? `оплата до ${premise.paymentDueDay}-го числа`
                          : "день оплаты не задан"}
                      </span>
                    </RehearsalsCard>
                  </div>

                  <div className="premises-overview__columns">
                    <RehearsalsCard fluid>
                      <div className="rehearsals-card-title">
                        Сегодня и ближайшие брони
                      </div>
                      {trackedSlots.length ? (
                        <ul className="premises-tracking-list">
                          {trackedSlots.map((slot) => (
                            <li
                              key={slot.id}
                              className="premises-tracking-item"
                            >
                              <button
                                type="button"
                                className="premises-tracking-item__main"
                                onClick={() => {
                                  setActiveTab("schedule");
                                  openEditSlot(slot);
                                }}
                              >
                                <span className="premises-tracking-item__time">
                                  {dayjs(slot.startsAt).format("D MMM, HH:mm")}
                                </span>
                                <strong>{slot.title}</strong>
                                <span className="rehearsals-muted">
                                  {formatSlotTime(slot)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="premises-overview__empty rehearsals-muted">
                          На сегодня и ближайшие дни броней нет.
                        </div>
                      )}
                    </RehearsalsCard>

                    <RehearsalsCard fluid>
                      <div className="rehearsals-card-title">
                        Требуют внимания
                      </div>
                      {pendingSlots.length ? (
                        <ul className="premises-tracking-list">
                          {pendingSlots.map((slot) => (
                            <li
                              key={slot.id}
                              className="premises-tracking-item"
                            >
                              <button
                                type="button"
                                className="premises-tracking-item__main"
                                onClick={() => openEditSlot(slot)}
                              >
                                <span className="premises-tracking-item__time">
                                  {dayjs(slot.startsAt).format("D MMM, HH:mm")}
                                </span>
                                <strong>{slot.title}</strong>
                                <span className="premises-tracking-item__status">
                                  Ожидает подтверждения
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="premises-overview__empty rehearsals-muted">
                          Нет заявок, ожидающих подтверждения.
                        </div>
                      )}
                    </RehearsalsCard>
                  </div>
                </div>
              ) : null}

              {activeTab === "schedule" ? (
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
                    </RehearsalsCard>
                  </aside>

                  <div className="sessions-main">
                    <RehearsalsCard fluid>
                      <div className="sessions-slots-readonly">
                        <div className="sessions-slots-readonly__header">
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
                              {slot.rentalAmountRub != null ? (
                                <div className="sessions-slots-readonly__notes">
                                  <b>Оплата:</b>{" "}
                                  {formatRubles(slot.rentalAmountRub)}
                                  {" · "}
                                  {paymentStatusLabel(slot.paymentStatus)}
                                </div>
                              ) : null}
                              <PremiseSlotContact slot={slot} />
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
                  </div>
                </div>
              ) : null}

              {activeTab === "members" && premise.canManage ? (
                <RehearsalsCard fluid className="premises-members-card">
                  <div className="rehearsals-card-title">
                    Участники помещения
                  </div>
                  <p className="rehearsals-muted">
                    Добавляйте арендаторов и назначайте права на бронирование.
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
                      onChange={(value) =>
                        setMemberRole(value as PremiseMemberRole)
                      }
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
                    {(membersData?.members ?? []).map((member) => (
                      <li key={member.id} className="premises-member-item">
                        <div className="premises-member-item__email">
                          {member.email}
                        </div>
                        <CustomSelect
                          value={member.role}
                          options={roleOptions}
                          onChange={(value) =>
                            void updateMember({
                              premiseId,
                              memberId: member.id,
                              body: { role: value as PremiseMemberRole },
                            })
                          }
                          aria-label={`Роль ${member.email}`}
                        />
                        <label className="premises-checkbox">
                          <input
                            type="checkbox"
                            checked={member.canBook}
                            onChange={(e) =>
                              void updateMember({
                                premiseId,
                                memberId: member.id,
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
                            if (!confirm(`Удалить ${member.email}?`)) return;
                            void removeMember({
                              premiseId,
                              memberId: member.id,
                            });
                          }}
                        >
                          Удалить
                        </Button>
                      </li>
                    ))}
                  </ul>
                </RehearsalsCard>
              ) : null}

              {activeTab === "settings" && premise.canManage ? (
                <div className="premises-settings">
                  <RehearsalsCard fluid>
                    <div className="rehearsals-card-title">Основные данные</div>
                    <div className="premises-settings__form">
                      <label className="premises-field">
                        <span>Название</span>
                        <InlineTextField
                          value={settingsName}
                          onChange={(e) => setSettingsName(e.target.value)}
                          maxLength={120}
                          aria-label="Название помещения"
                        />
                      </label>
                      <label className="premises-field">
                        <span>Тип помещения</span>
                        <CustomSelect
                          value={settingsKind}
                          options={premiseKindOptions}
                          onChange={(value) =>
                            setSettingsKind(value as PremiseKind)
                          }
                          aria-label="Тип помещения"
                        />
                      </label>
                      <label className="premises-field">
                        <span>Адрес</span>
                        <InlineTextField
                          value={settingsAddress}
                          onChange={(e) => setSettingsAddress(e.target.value)}
                          maxLength={300}
                          aria-label="Адрес помещения"
                        />
                      </label>
                      <label className="premises-field">
                        <span>Вместимость</span>
                        <InlineTextField
                          value={settingsCapacity}
                          onChange={(e) => setSettingsCapacity(e.target.value)}
                          inputMode="numeric"
                          aria-label="Вместимость помещения"
                        />
                      </label>
                      <label className="premises-field">
                        <span>Оплата аренды до числа месяца</span>
                        <InlineTextField
                          value={settingsPaymentDueDay}
                          onChange={(e) =>
                            setSettingsPaymentDueDay(e.target.value)
                          }
                          inputMode="numeric"
                          placeholder="Например, 10"
                          aria-label="День месяца для оплаты аренды"
                        />
                      </label>
                      <FormTextarea
                        label="Заметки"
                        value={settingsNotes}
                        onChange={(e) => setSettingsNotes(e.target.value)}
                        rows={4}
                      />
                      {settingsError ? (
                        <div className="rehearsals-error">{settingsError}</div>
                      ) : null}
                      <div className="premises-settings__actions">
                        <Button
                          type="button"
                          disabled={updatingPremise || !settingsName.trim()}
                          onClick={() => void handleSaveSettings()}
                        >
                          {updatingPremise ? "Сохранение…" : "Сохранить"}
                        </Button>
                      </div>
                    </div>
                  </RehearsalsCard>
                  <RehearsalsCard fluid className="premises-settings__danger">
                    <div className="rehearsals-card-title">
                      Удаление помещения
                    </div>
                    <p className="rehearsals-muted">
                      Будут удалены расписание и права участников помещения.
                    </p>
                    <Button
                      type="button"
                      className="danger"
                      disabled={deletingPremise}
                      onClick={() => void handleDeletePremise()}
                    >
                      {deletingPremise ? "Удаление…" : "Удалить помещение"}
                    </Button>
                  </RehearsalsCard>
                </div>
              ) : null}
            </div>
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
            label="Условия аренды и договорённости"
            value={slotForm.rentalNotes}
            onChange={(e) =>
              setSlotForm((s) => ({ ...s, rentalNotes: e.target.value }))
            }
            rows={3}
          />
          {premise.canManage ? (
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
                  placeholder="Сумма, ₽"
                  aria-label="Сумма аренды в рублях"
                />
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
          {slotError ? <div className="premises-error">{slotError}</div> : null}
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
