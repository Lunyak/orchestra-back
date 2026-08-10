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
  useCreatePremiseRentalMutation,
  useDeletePremiseMutation,
  useDeletePremiseSlotMutation,
  useGetPremiseQuery,
  useGeneratePremiseRentalAgreementMutation,
  useListPremiseRentalsQuery,
  useListPremiseMembersQuery,
  useListPremiseSlotsQuery,
  useRemovePremiseMemberMutation,
  useUpdatePremiseMutation,
  useUpdatePremiseMemberMutation,
  useUpdatePremiseRentalPaymentMutation,
  useUpdatePremiseRentalStatusMutation,
  useUpdatePremiseSlotMutation,
  useUploadPremiseRentalAgreementMutation,
} from "../../features/premises";
import type {
  CreatePremiseSlotPayload,
  CreatePremiseRentalPayload,
  PremiseAvailabilityDay,
  PremiseKind,
  PremiseMemberRole,
  PremiseSlotPaymentStatus,
  PremiseSlotItem,
  PremiseSlotStatus,
  PremiseRecurrenceType,
  PremiseRentalItem,
  PremiseUsageType,
  UpdatePremiseSlotPayload,
} from "../../sync/api/premises";
import { api } from "../../sync/api/client";
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

const usageTypeOptions: { value: PremiseUsageType; label: string }[] = [
  { value: "internal", label: "Своя репетиция / мероприятие" },
  { value: "friendly", label: "Бесплатная бронь" },
  { value: "commercial", label: "Коммерческая аренда" },
];

const recurrenceTypeOptions: {
  value: PremiseRecurrenceType;
  label: string;
}[] = [
  { value: "once", label: "Разовая" },
  { value: "weekly", label: "Регулярная" },
];

type PremiseTab = "overview" | "schedule" | "rentals" | "members" | "settings";

type AvailabilityFormDay = PremiseAvailabilityDay & {
  label: string;
  enabled: boolean;
};

type RentalScheduleFormDay = {
  weekday: number;
  label: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
};

type FreePremiseInterval = {
  startsAt: dayjs.Dayjs;
  endsAt: dayjs.Dayjs;
  durationMin: number;
};

const weekDays: { weekday: number; label: string }[] = [
  { weekday: 1, label: "Понедельник" },
  { weekday: 2, label: "Вторник" },
  { weekday: 3, label: "Среда" },
  { weekday: 4, label: "Четверг" },
  { weekday: 5, label: "Пятница" },
  { weekday: 6, label: "Суббота" },
  { weekday: 0, label: "Воскресенье" },
];

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function formatDuration(durationMin: number): string {
  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  const parts = [
    hours ? `${hours} ч` : "",
    minutes ? `${minutes} мин` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

function createAvailabilityForm(
  availability: PremiseAvailabilityDay[] = [],
): AvailabilityFormDay[] {
  return weekDays.map((day) => {
    const configuredDay = availability.find(
      (item) => item.weekday === day.weekday,
    );
    return {
      ...day,
      enabled: configuredDay != null,
      startsAtMin: configuredDay?.startsAtMin ?? 9 * 60,
      endsAtMin: configuredDay?.endsAtMin ?? 22 * 60,
    };
  });
}

function createRentalScheduleForm(dayIso: string): RentalScheduleFormDay[] {
  const selectedWeekday = dayjs(dayIso).day();
  return weekDays.map((day) => ({
    ...day,
    enabled: day.weekday === selectedWeekday,
    startsAt: "10:00",
    endsAt: "12:00",
  }));
}

type SlotFormState = {
  usageType: PremiseUsageType;
  recurrenceType: PremiseRecurrenceType;
  startsAtLocal: string;
  periodStartsOn: string;
  periodEndsOn: string;
  indefinite: boolean;
  schedules: RentalScheduleFormDay[];
  durationMin: string;
  title: string;
  purpose: string;
  rentalNotes: string;
  rentalAmountRub: string;
  paymentDueDay: string;
  paymentStatus: PremiseSlotPaymentStatus;
  agreementRequested: boolean;
  landlordName: string;
  landlordDetails: string;
  tenantName: string;
  tenantDetails: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  status: PremiseSlotStatus;
};

function emptySlotForm(dayIso: string): SlotFormState {
  const base = dayjs(dayIso).hour(10).minute(0).second(0).millisecond(0);
  return {
    usageType: "internal",
    recurrenceType: "once",
    startsAtLocal: base.format("YYYY-MM-DDTHH:mm"),
    periodStartsOn: dayIso,
    periodEndsOn: dayjs(dayIso).add(1, "month").format("YYYY-MM-DD"),
    indefinite: false,
    schedules: createRentalScheduleForm(dayIso),
    durationMin: "120",
    title: "",
    purpose: "",
    rentalNotes: "",
    rentalAmountRub: "",
    paymentDueDay: "",
    paymentStatus: "unpaid",
    agreementRequested: false,
    landlordName: "",
    landlordDetails: "",
    tenantName: "",
    tenantDetails: "",
    contactEmail: "",
    contactName: "",
    contactPhone: "",
    status: "confirmed",
  };
}

function slotToForm(slot: PremiseSlotItem): SlotFormState {
  const startsOn = dayjs(slot.startsAt).format("YYYY-MM-DD");
  return {
    usageType:
      slot.rental?.usageType ??
      (slot.rentalAmountRub != null ? "commercial" : "internal"),
    recurrenceType: "once",
    startsAtLocal: toDatetimeLocalValue(slot.startsAt),
    periodStartsOn: startsOn,
    periodEndsOn: startsOn,
    indefinite: false,
    schedules: createRentalScheduleForm(startsOn),
    durationMin: String(slot.durationMin),
    title: slot.title,
    purpose: slot.purpose ?? "",
    rentalNotes: slot.rentalNotes ?? "",
    rentalAmountRub:
      slot.rentalAmountRub == null ? "" : String(slot.rentalAmountRub),
    paymentDueDay: "",
    paymentStatus: slot.paymentStatus,
    agreementRequested: slot.rental?.agreementRequested ?? false,
    landlordName: "",
    landlordDetails: "",
    tenantName: slot.contactName ?? "",
    tenantDetails: "",
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

function usageTypeLabel(usageType: PremiseUsageType): string {
  return (
    usageTypeOptions.find((option) => option.value === usageType)?.label ??
    usageType
  );
}

function rentalStatusLabel(status: PremiseRentalItem["status"]): string {
  const labels: Record<PremiseRentalItem["status"], string> = {
    pending: "Ожидает подтверждения",
    active: "Действует",
    cancelled: "Отменена",
    completed: "Завершена",
  };
  return labels[status];
}

function agreementStatusLabel(
  status: NonNullable<PremiseRentalItem["agreement"]>["status"],
): string {
  const labels: Record<
    NonNullable<PremiseRentalItem["agreement"]>["status"],
    string
  > = {
    draft: "Черновик",
    awaiting_signature: "Ожидает подписания",
    active: "Подписан",
    terminated: "Расторгнут",
    expired: "Завершён",
  };
  return labels[status];
}

function rentalContactLabel(rental: PremiseRentalItem): string {
  return [rental.contactName, rental.contactPhone, rental.contactEmail]
    .filter(Boolean)
    .join(" · ");
}

function formatRentalDate(value: string): string {
  return dayjs(value.slice(0, 10)).format("D MMM YYYY");
}

type UpcomingSlotGroup = {
  id: string;
  label: string;
  slots: PremiseSlotItem[];
};

function groupUpcomingSlots(slots: PremiseSlotItem[]): UpcomingSlotGroup[] {
  const today = dayjs().startOf("day");
  const tomorrow = today.add(1, "day");
  const dayAfter = today.add(2, "day");
  const weekEnd = today.add(7, "day");
  const monthEnd = today.add(1, "month");

  const groups: UpcomingSlotGroup[] = [
    { id: "today", label: "Сегодня", slots: [] },
    { id: "tomorrow", label: "Завтра", slots: [] },
    { id: "day-after", label: "Послезавтра", slots: [] },
    { id: "week", label: "Через неделю", slots: [] },
    { id: "month", label: "Через месяц", slots: [] },
  ];

  slots
    .filter((slot) => !dayjs(slot.startsAt).isBefore(today))
    .sort(
      (left, right) =>
        dayjs(left.startsAt).valueOf() - dayjs(right.startsAt).valueOf(),
    )
    .forEach((slot) => {
      const day = dayjs(slot.startsAt).startOf("day");
      if (day.isSame(today)) {
        groups[0].slots.push(slot);
        return;
      }
      if (day.isSame(tomorrow)) {
        groups[1].slots.push(slot);
        return;
      }
      if (day.isSame(dayAfter)) {
        groups[2].slots.push(slot);
        return;
      }
      if (!day.isAfter(weekEnd)) {
        groups[3].slots.push(slot);
        return;
      }
      if (!day.isAfter(monthEnd)) {
        groups[4].slots.push(slot);
      }
    });

  return groups.filter((group) => group.slots.length > 0);
}

function buildCancelRentalWarning(rental: PremiseRentalItem): string {
  const unpaidPayments = rental.payments.filter(
    (payment) => payment.status === "unpaid",
  ).length;
  const warnings = [
    `Отменить аренду «${rental.title}»?`,
    "",
    rental.recurrenceType === "weekly"
      ? "Будут отменены все слоты этой регулярной серии."
      : "Будет отменён связанный слот бронирования.",
  ];
  if (rental.agreement) {
    warnings.push(
      `Договор ${rental.agreement.number} останется в статусе «${agreementStatusLabel(rental.agreement.status)}» — отмена аренды его не подписывает и не удаляет.`,
    );
  }
  if (unpaidPayments > 0) {
    warnings.push(
      `Останется ${unpaidPayments} неоплаченных платежей по этой аренде.`,
    );
  }
  warnings.push("", "Это действие нельзя отменить из списка аренд.");
  return warnings.join("\n");
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

function MapPinIcon() {
  return (
    <svg
      className="premises-page__address-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function getOrganizationInitials(title: string): string {
  return title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("ru-RU");
}

function calculateFreeIntervals(
  selectedDate: string,
  workingDay: PremiseAvailabilityDay | undefined,
  slots: PremiseSlotItem[],
): FreePremiseInterval[] {
  if (!workingDay) return [];

  const dayStart = dayjs(selectedDate).startOf("day");
  const workingStart = dayStart.add(workingDay.startsAtMin, "minute");
  const workingEnd = dayStart.add(workingDay.endsAtMin, "minute");
  const occupiedIntervals = slots
    .filter((slot) => slot.status !== "cancelled")
    .map((slot) => {
      const startsAt = dayjs(slot.startsAt);
      return {
        startsAt,
        endsAt: startsAt.add(slot.durationMin, "minute"),
      };
    })
    .sort((left, right) => left.startsAt.valueOf() - right.startsAt.valueOf());
  const freeIntervals: FreePremiseInterval[] = [];
  let cursor = workingStart;

  occupiedIntervals.forEach((occupied) => {
    if (!occupied.endsAt.isAfter(cursor)) return;
    if (occupied.startsAt.isAfter(cursor)) {
      const freeEnd = occupied.startsAt.isBefore(workingEnd)
        ? occupied.startsAt
        : workingEnd;
      if (freeEnd.isAfter(cursor)) {
        freeIntervals.push({
          startsAt: cursor,
          endsAt: freeEnd,
          durationMin: freeEnd.diff(cursor, "minute"),
        });
      }
    }
    if (occupied.endsAt.isAfter(cursor)) {
      cursor = occupied.endsAt;
    }
  });

  if (cursor.isBefore(workingEnd)) {
    freeIntervals.push({
      startsAt: cursor,
      endsAt: workingEnd,
      durationMin: workingEnd.diff(cursor, "minute"),
    });
  }

  return freeIntervals;
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
  const [settingsAvailability, setSettingsAvailability] = useState<
    AvailabilityFormDay[]
  >(() => createAvailabilityForm());
  const [settingsNotes, setSettingsNotes] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [rentalActionId, setRentalActionId] = useState<string | null>(null);
  const [rentalActionError, setRentalActionError] = useState<string | null>(
    null,
  );

  const range = useMemo(() => {
    const calendarRange = calendarState
      ? { from: calendarState.fromIso, to: calendarState.toIso }
      : monthRangeIso(new Date());
    const overviewFrom = dayjs().startOf("day");
    const overviewTo = dayjs().add(1, "month").endOf("day");
    const from = dayjs(calendarRange.from).isBefore(overviewFrom)
      ? calendarRange.from
      : overviewFrom.toISOString();
    const to = dayjs(calendarRange.to).isAfter(overviewTo)
      ? calendarRange.to
      : overviewTo.toISOString();
    return { from, to };
  }, [calendarState]);
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
  const { data: rentalsData } = useListPremiseRentalsQuery(premiseId, {
    skip: !accessToken || !premiseId,
  });

  const [createRental, { isLoading: creatingRental }] =
    useCreatePremiseRentalMutation();
  const [generateAgreement] = useGeneratePremiseRentalAgreementMutation();
  const [updateRentalPayment] = useUpdatePremiseRentalPaymentMutation();
  const [updateRentalStatus] = useUpdatePremiseRentalStatusMutation();
  const [uploadAgreement] = useUploadPremiseRentalAgreementMutation();
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
  const selectedWorkingDay = premise?.weeklyAvailability?.find(
    (day) => day.weekday === dayjs(selectedDate).day(),
  );
  const freeIntervals = useMemo(
    () => calculateFreeIntervals(selectedDate, selectedWorkingDay, daySlots),
    [daySlots, selectedDate, selectedWorkingDay],
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
  const trackedSlotGroups = useMemo(
    () => groupUpcomingSlots(activeSlots),
    [activeSlots],
  );
  const hasTrackedSlots = trackedSlotGroups.length > 0;
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
    setSettingsAvailability(createAvailabilityForm(premise.weeklyAvailability));
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

  function openCreateSlotForInterval(interval: FreePremiseInterval) {
    setEditingSlot(null);
    const form = emptySlotForm(selectedDate);
    const schedules = form.schedules.map((day) =>
      day.weekday === interval.startsAt.day()
        ? {
            ...day,
            enabled: true,
            startsAt: interval.startsAt.format("HH:mm"),
            endsAt: interval.endsAt.format("HH:mm"),
          }
        : { ...day, enabled: false },
    );
    setSlotForm({
      ...form,
      startsAtLocal: interval.startsAt.format("YYYY-MM-DDTHH:mm"),
      durationMin: String(interval.durationMin),
      schedules,
    });
    setSlotError(null);
    setSlotModalOpen(true);
  }

  function updateAvailabilityDay(
    weekday: number,
    patch: Partial<
      Pick<AvailabilityFormDay, "enabled" | "startsAtMin" | "endsAtMin">
    >,
  ) {
    setSettingsAvailability((days) =>
      days.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)),
    );
  }

  function updateRentalScheduleDay(
    weekday: number,
    patch: Partial<
      Pick<RentalScheduleFormDay, "enabled" | "startsAt" | "endsAt">
    >,
  ) {
    setSlotForm((state) => ({
      ...state,
      schedules: state.schedules.map((day) =>
        day.weekday === weekday ? { ...day, ...patch } : day,
      ),
    }));
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
    const paymentDueDay = slotForm.paymentDueDay
      ? Number(slotForm.paymentDueDay)
      : null;
    const enabledSchedules = slotForm.schedules
      .filter((day) => day.enabled)
      .map((day) => ({
        weekday: day.weekday,
        startsAtMin: timeToMinutes(day.startsAt),
        durationMin: timeToMinutes(day.endsAt) - timeToMinutes(day.startsAt),
      }));
    const hasInvalidSchedule = enabledSchedules.some(
      (schedule) =>
        !Number.isInteger(schedule.durationMin) ||
        schedule.durationMin < 1 ||
        schedule.startsAtMin + schedule.durationMin > 1440,
    );
    const isRecurring = slotForm.recurrenceType === "weekly";
    const isCommercial = slotForm.usageType === "commercial";
    const needsOneTimeDuration = editingSlot != null || !isRecurring;
    const hasInvalidAmount =
      rentalAmountRub != null &&
      (!Number.isInteger(rentalAmountRub) || rentalAmountRub < 0);
    const hasInvalidPaymentDay =
      paymentDueDay != null &&
      (!Number.isInteger(paymentDueDay) ||
        paymentDueDay < 1 ||
        paymentDueDay > 31);
    const hasInvalidPeriod =
      isRecurring &&
      (!slotForm.periodStartsOn ||
        (!slotForm.indefinite &&
          (!slotForm.periodEndsOn ||
            dayjs(slotForm.periodEndsOn).isBefore(
              dayjs(slotForm.periodStartsOn),
            ))));
    const hasMissingAgreementParties =
      slotForm.agreementRequested &&
      (!slotForm.landlordName.trim() || !slotForm.tenantName.trim());
    if (
      !slotForm.title.trim() ||
      (needsOneTimeDuration &&
        (!Number.isFinite(durationMin) || durationMin < 1)) ||
      hasInvalidAmount ||
      hasInvalidPaymentDay ||
      hasInvalidPeriod ||
      (isRecurring && (enabledSchedules.length === 0 || hasInvalidSchedule)) ||
      (isCommercial && rentalAmountRub == null) ||
      (isCommercial && isRecurring && paymentDueDay == null) ||
      hasMissingAgreementParties
    ) {
      setSlotError("Проверьте обязательные поля аренды и расписание");
      return;
    }
    setSlotError(null);
    const slotBody: CreatePremiseSlotPayload = {
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
          ...slotBody,
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
        const startsOn = isRecurring
          ? slotForm.periodStartsOn
          : slotForm.startsAtLocal.slice(0, 10);
        const rentalBody: CreatePremiseRentalPayload = {
          usageType: slotForm.usageType,
          recurrenceType: slotForm.recurrenceType,
          title: slotForm.title.trim(),
          purpose: slotForm.purpose.trim() || undefined,
          rentalNotes: slotForm.rentalNotes.trim() || undefined,
          contactEmail: slotForm.contactEmail.trim() || undefined,
          contactName: slotForm.contactName.trim() || undefined,
          contactPhone: slotForm.contactPhone.trim() || undefined,
          startsOn: `${startsOn}T00:00:00.000Z`,
          timezoneOffsetMin: new Date().getTimezoneOffset(),
          ...(isRecurring
            ? {
                indefinite: slotForm.indefinite,
                ...(!slotForm.indefinite
                  ? {
                      endsOn: `${slotForm.periodEndsOn}T23:59:59.999Z`,
                    }
                  : {}),
                schedules: enabledSchedules,
              }
            : {
                startsAt: fromDatetimeLocalValue(slotForm.startsAtLocal),
                durationMin,
              }),
          ...(isCommercial
            ? isRecurring
              ? {
                  monthlyAmountRub: rentalAmountRub ?? undefined,
                  paymentDueDay: paymentDueDay ?? undefined,
                }
              : { amountRub: rentalAmountRub ?? undefined }
            : {}),
          agreementRequested: slotForm.agreementRequested,
          ...(slotForm.agreementRequested
            ? {
                landlordName: slotForm.landlordName.trim(),
                landlordDetails: slotForm.landlordDetails.trim() || undefined,
                tenantName: slotForm.tenantName.trim(),
                tenantDetails: slotForm.tenantDetails.trim() || undefined,
              }
            : {}),
        };
        await createRental({ premiseId, body: rentalBody }).unwrap();
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
    const weeklyAvailability = settingsAvailability
      .filter((day) => day.enabled)
      .map(({ weekday, startsAtMin, endsAtMin }) => ({
        weekday,
        startsAtMin,
        endsAtMin,
      }));
    const hasInvalidWorkingHours = weeklyAvailability.some(
      (day) => day.startsAtMin >= day.endsAtMin,
    );
    if (
      !name ||
      (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) ||
      hasInvalidWorkingHours
    ) {
      setSettingsError("Проверьте название, вместимость и рабочее время");
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
          weeklyAvailability,
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

  async function handleGenerateAgreement(rentalId: string) {
    setRentalActionId(rentalId);
    setRentalActionError(null);
    try {
      await generateAgreement({ premiseId, rentalId }).unwrap();
    } catch (error: unknown) {
      setRentalActionError(
        extractError(error, "Не удалось сформировать договор"),
      );
    } finally {
      setRentalActionId(null);
    }
  }

  async function handleRentalStatus(
    rental: PremiseRentalItem,
    status: "active" | "cancelled",
  ) {
    if (
      status === "cancelled" &&
      !confirm(buildCancelRentalWarning(rental))
    ) {
      return;
    }
    setRentalActionId(rental.id);
    setRentalActionError(null);
    try {
      await updateRentalStatus({
        premiseId,
        rentalId: rental.id,
        status,
      }).unwrap();
    } catch (error: unknown) {
      setRentalActionError(
        extractError(error, "Не удалось изменить статус аренды"),
      );
    } finally {
      setRentalActionId(null);
    }
  }

  async function handleRentalPayment(
    rentalId: string,
    paymentId: string,
    status: PremiseSlotPaymentStatus,
  ) {
    setRentalActionId(rentalId);
    setRentalActionError(null);
    try {
      await updateRentalPayment({
        premiseId,
        rentalId,
        paymentId,
        status,
      }).unwrap();
    } catch (error: unknown) {
      setRentalActionError(
        extractError(error, "Не удалось изменить статус платежа"),
      );
    } finally {
      setRentalActionId(null);
    }
  }

  async function handleUploadAgreement(
    rentalId: string,
    kind: "uploaded" | "signed",
    file: File,
  ) {
    setRentalActionId(rentalId);
    setRentalActionError(null);
    try {
      await uploadAgreement({ premiseId, rentalId, kind, file }).unwrap();
    } catch (error: unknown) {
      setRentalActionError(extractError(error, "Не удалось загрузить договор"));
    } finally {
      setRentalActionId(null);
    }
  }

  async function handleDownloadAgreement(
    rentalId: string,
    documentId: string,
    fileName: string,
  ) {
    setRentalActionError(null);
    try {
      const response = await api.get(
        `/premises/${encodeURIComponent(premiseId)}/rentals/${encodeURIComponent(rentalId)}/agreement/documents/${encodeURIComponent(documentId)}`,
        { responseType: "blob" },
      );
      const objectUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error: unknown) {
      setRentalActionError(extractError(error, "Не удалось скачать документ"));
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
                    <span
                      className="premises-page__organization-logo"
                      aria-hidden
                    >
                      {getOrganizationInitials(premise.ownerTitle)}
                    </span>
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
                  {premise.address ? (
                    <p className="rehearsals-muted premises-page__address">
                      <MapPinIcon />
                      <span>{premise.address}</span>
                    </p>
                  ) : null}
                  {premise.notes ? (
                    <p className="rehearsals-muted premises-page__subtitle">
                      {premise.notes}
                    </p>
                  ) : null}
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
                    ["rentals", "Аренды"],
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
                        по неоплаченным броням
                      </span>
                    </RehearsalsCard>
                  </div>

                  <div className="premises-overview__columns">
                    <RehearsalsCard fluid className="premises-upcoming-card">
                      <div className="rehearsals-card-title">
                        Ближайшие брони
                      </div>
                      {hasTrackedSlots ? (
                        <div className="premises-upcoming-groups">
                          {trackedSlotGroups.map((group) => (
                            <section
                              key={group.id}
                              className="premises-upcoming-group"
                            >
                              <div className="premises-upcoming-group__header">
                                <h3 className="premises-upcoming-group__title">
                                  {group.label}
                                </h3>
                                <span className="premises-upcoming-group__count">
                                  {group.slots.length}
                                </span>
                              </div>
                              <ul className="premises-tracking-list">
                                {group.slots.map((slot) => (
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
                                        {dayjs(slot.startsAt).format(
                                          "D MMM, HH:mm",
                                        )}
                                      </span>
                                      <strong>{slot.title}</strong>
                                      <span className="rehearsals-muted">
                                        {formatSlotTime(slot)}
                                      </span>
                                    </button>
                                  </li>
                                ))}
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

                  <div className="sessions-main premises-day-panels">
                    <RehearsalsCard fluid className="premises-day-panel">
                      <div className="sessions-slots-readonly__header">
                        <span className="rehearsals-section-title">
                          Свободное время
                        </span>
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
                                disabled={!premise.canBook}
                                onClick={() =>
                                  openCreateSlotForInterval(interval)
                                }
                                title={
                                  premise.canBook
                                    ? "Забронировать этот интервал"
                                    : "Нет права бронирования"
                                }
                              >
                                <strong>
                                  {interval.startsAt.format("HH:mm")} —{" "}
                                  {interval.endsAt.format("HH:mm")}
                                </strong>
                                <span>
                                  {formatDuration(interval.durationMin)}
                                </span>
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
                          {premise.canBook ? (
                            <Button type="button" onClick={openCreateSlot}>
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
                              {daySlots.map((slot) => (
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
                                        onClick={() =>
                                          void handleDeleteSlot(slot)
                                        }
                                      >
                                        Удалить
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </RehearsalsCard>
                  </div>
                </div>
              ) : null}

              {activeTab === "rentals" ? (
                <div className="premises-rentals">
                  <div className="premises-rentals__header">
                    <div>
                      <div className="rehearsals-card-title">Аренды</div>
                      <p className="rehearsals-muted">
                        Разовые и регулярные серии, платежи и документы.
                      </p>
                    </div>
                    {premise.canBook ? (
                      <Button type="button" onClick={openCreateSlot}>
                        Новая аренда
                      </Button>
                    ) : null}
                  </div>
                  {rentalActionError ? (
                    <div className="rehearsals-error">{rentalActionError}</div>
                  ) : null}
                  {(rentalsData?.rentals ?? []).length ? (
                    <div className="premises-rentals__list">
                      {(rentalsData?.rentals ?? []).map((rental) => {
                        const normalizedUserEmail = userEmail
                          .trim()
                          .toLowerCase();
                        const canManageRental =
                          premise.canManage ||
                          rental.createdByEmail.trim().toLowerCase() ===
                            normalizedUserEmail ||
                          rental.contactEmail?.trim().toLowerCase() ===
                            normalizedUserEmail;
                        const rentalPeriod =
                          rental.recurrenceType === "weekly"
                            ? rental.endsOn
                              ? `${formatRentalDate(rental.startsOn)} — ${formatRentalDate(rental.endsOn)}`
                              : `с ${formatRentalDate(rental.startsOn)} · бессрочно`
                            : formatRentalDate(rental.startsOn);
                        const rentalPrice =
                          rental.monthlyAmountRub != null
                            ? `${formatRubles(rental.monthlyAmountRub)} в месяц`
                            : null;
                        return (
                          <RehearsalsCard
                            key={rental.id}
                            fluid
                            className="premises-rental-card"
                          >
                            <div className="premises-rental-card__header">
                              <div>
                                <strong>{rental.title}</strong>
                                <div className="rehearsals-muted">
                                  {usageTypeLabel(rental.usageType)}
                                  {" · "}
                                  {rental.recurrenceType === "weekly"
                                    ? "Регулярная"
                                    : "Разовая"}
                                  {" · "}
                                  {rentalPeriod}
                                </div>
                              </div>
                              <span
                                className={cn(
                                  "premises-rental-card__status",
                                  rental.status === "active" &&
                                    "premises-rental-card__status--active",
                                )}
                              >
                                {rentalStatusLabel(rental.status)}
                              </span>
                            </div>
                            {rentalPrice ? (
                              <div className="premises-rental-card__price">
                                {rentalPrice}
                                {rental.paymentDueDay
                                  ? ` · до ${rental.paymentDueDay}-го числа`
                                  : ""}
                              </div>
                            ) : null}
                            {rental.payments.length ? (
                              <div className="premises-rental-payments">
                                {rental.payments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    className="premises-rental-payment"
                                  >
                                    <span>
                                      {formatRentalDate(payment.periodStart)}
                                      {" · "}
                                      {formatRubles(payment.amountRub)}
                                      {" · до "}
                                      {formatRentalDate(payment.dueAt)}
                                    </span>
                                    {premise.canManage ? (
                                      <CustomSelect
                                        value={payment.status}
                                        options={paymentStatusOptions}
                                        onChange={(value) =>
                                          void handleRentalPayment(
                                            rental.id,
                                            payment.id,
                                            value as PremiseSlotPaymentStatus,
                                          )
                                        }
                                        aria-label={`Статус платежа за ${formatRentalDate(payment.periodStart)}`}
                                      />
                                    ) : (
                                      <span>
                                        {paymentStatusLabel(payment.status)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {rental.contactName ||
                            rental.contactPhone ||
                            rental.contactEmail ? (
                              <div className="rehearsals-muted">
                                Контакт: {rentalContactLabel(rental)}
                              </div>
                            ) : null}
                            {premise.canManage &&
                            rental.status !== "cancelled" ? (
                              <div className="premises-rental-card__actions">
                                {rental.status === "pending" &&
                                !rental.agreementRequested ? (
                                  <Button
                                    type="button"
                                    disabled={rentalActionId === rental.id}
                                    onClick={() =>
                                      void handleRentalStatus(rental, "active")
                                    }
                                  >
                                    Подтвердить аренду
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  className="danger"
                                  disabled={rentalActionId === rental.id}
                                  onClick={() =>
                                    void handleRentalStatus(
                                      rental,
                                      "cancelled",
                                    )
                                  }
                                >
                                  Отменить аренду
                                </Button>
                              </div>
                            ) : null}
                            {rental.agreement ? (
                              <div className="premises-rental-contract">
                                <div className="premises-rental-contract__header">
                                  <strong>
                                    Договор {rental.agreement.number}
                                  </strong>
                                  <span>
                                    {agreementStatusLabel(
                                      rental.agreement.status,
                                    )}
                                  </span>
                                </div>
                                {rental.agreement.documents.length ? (
                                  <div className="premises-rental-contract__documents">
                                    {rental.agreement.documents.map(
                                      (documentItem) => (
                                        <button
                                          key={documentItem.id}
                                          type="button"
                                          onClick={() =>
                                            void handleDownloadAgreement(
                                              rental.id,
                                              documentItem.id,
                                              documentItem.fileName,
                                            )
                                          }
                                        >
                                          {documentItem.kind === "signed"
                                            ? "Подписанный"
                                            : documentItem.kind === "generated"
                                              ? "Сформированный"
                                              : "Загруженный"}
                                          : {documentItem.fileName}
                                        </button>
                                      ),
                                    )}
                                  </div>
                                ) : null}
                                {canManageRental ? (
                                  <div className="premises-rental-contract__actions">
                                    <Button
                                      type="button"
                                      disabled={rentalActionId === rental.id}
                                      onClick={() =>
                                        void handleGenerateAgreement(rental.id)
                                      }
                                    >
                                      Сформировать PDF
                                    </Button>
                                    <label className="premises-rental-contract__upload">
                                      Загрузить свой PDF
                                      <input
                                        type="file"
                                        accept="application/pdf,.pdf"
                                        onChange={(event) => {
                                          const file = event.target.files?.[0];
                                          if (!file) return;
                                          void handleUploadAgreement(
                                            rental.id,
                                            "uploaded",
                                            file,
                                          );
                                          event.target.value = "";
                                        }}
                                      />
                                    </label>
                                    <label className="premises-rental-contract__upload premises-rental-contract__upload--signed">
                                      Загрузить подписанный
                                      <input
                                        type="file"
                                        accept="application/pdf,.pdf"
                                        onChange={(event) => {
                                          const file = event.target.files?.[0];
                                          if (!file) return;
                                          void handleUploadAgreement(
                                            rental.id,
                                            "signed",
                                            file,
                                          );
                                          event.target.value = "";
                                        }}
                                      />
                                    </label>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="rehearsals-muted">
                                Без договора
                              </div>
                            )}
                          </RehearsalsCard>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="premises-overview__empty rehearsals-muted">
                      Аренд пока нет.
                    </div>
                  )}
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
                  <RehearsalsCard fluid className="premises-settings__main">
                    <div className="rehearsals-card-title">Основные данные</div>
                    <div className="premises-settings__form">
                      <label className="premises-settings__field premises-settings__field--wide">
                        <span>Название</span>
                        <InlineTextField
                          value={settingsName}
                          onChange={(e) => setSettingsName(e.target.value)}
                          maxLength={120}
                          aria-label="Название помещения"
                        />
                      </label>
                      <label className="premises-settings__field premises-settings__field--wide">
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
                      <label className="premises-settings__field premises-settings__field--wide">
                        <span>Адрес</span>
                        <InlineTextField
                          value={settingsAddress}
                          onChange={(e) => setSettingsAddress(e.target.value)}
                          maxLength={300}
                          aria-label="Адрес помещения"
                        />
                      </label>
                      <label className="premises-settings__field premises-settings__field--wide">
                        <span>Вместимость</span>
                        <InlineTextField
                          value={settingsCapacity}
                          onChange={(e) => setSettingsCapacity(e.target.value)}
                          inputMode="numeric"
                          aria-label="Вместимость помещения"
                        />
                      </label>
                      <div className="premises-availability-settings">
                        <div className="premises-availability-settings__header">
                          <strong>Рабочее время</strong>
                          <span className="rehearsals-muted">
                            По нему рассчитываются свободные интервалы
                          </span>
                        </div>
                        <div className="premises-availability-settings__days">
                          {settingsAvailability.map((day) => (
                            <div
                              key={day.weekday}
                              className={cn(
                                "premises-availability-day",
                                !day.enabled &&
                                  "premises-availability-day--disabled",
                              )}
                            >
                              <label className="premises-checkbox premises-availability-day__toggle">
                                <input
                                  type="checkbox"
                                  checked={day.enabled}
                                  onChange={(event) =>
                                    updateAvailabilityDay(day.weekday, {
                                      enabled: event.target.checked,
                                    })
                                  }
                                />
                                {day.label}
                              </label>
                              {day.enabled ? (
                                <div className="premises-availability-day__time">
                                  <input
                                    type="time"
                                    value={minutesToTime(day.startsAtMin)}
                                    onChange={(event) =>
                                      updateAvailabilityDay(day.weekday, {
                                        startsAtMin: timeToMinutes(
                                          event.target.value,
                                        ),
                                      })
                                    }
                                    aria-label={`Начало работы, ${day.label}`}
                                  />
                                  <span>—</span>
                                  <input
                                    type="time"
                                    value={minutesToTime(day.endsAtMin)}
                                    onChange={(event) =>
                                      updateAvailabilityDay(day.weekday, {
                                        endsAtMin: timeToMinutes(
                                          event.target.value,
                                        ),
                                      })
                                    }
                                    aria-label={`Окончание работы, ${day.label}`}
                                  />
                                </div>
                              ) : (
                                <span className="rehearsals-muted">
                                  Выходной
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <FormTextarea
                        label="Заметки"
                        value={settingsNotes}
                        onChange={(e) => setSettingsNotes(e.target.value)}
                        rows={4}
                      />
                      {settingsError ? (
                        <div className="rehearsals-error">{settingsError}</div>
                      ) : null}
                    </div>
                  </RehearsalsCard>
                  <RehearsalsCard fluid className="premises-settings__danger">
                    <div className="rehearsals-card-title">
                      Удаление помещения
                    </div>
                    <p className="rehearsals-muted">
                      Удаление необратимо. Будут удалены расписание, настройки и
                      права участников помещения.
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
                  <div className="premises-settings__footer">
                    <Button
                      type="button"
                      disabled={updatingPremise || !settingsName.trim()}
                      onClick={() => void handleSaveSettings()}
                    >
                      {updatingPremise ? "Сохранение…" : "Сохранить ✓"}
                    </Button>
                  </div>
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
                          updateRentalScheduleDay(day.weekday, {
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
                            updateRentalScheduleDay(day.weekday, {
                              startsAt: event.target.value,
                            })
                          }
                          aria-label={`Начало, ${day.label}`}
                        />
                        <input
                          type="time"
                          value={day.endsAt}
                          onChange={(event) =>
                            updateRentalScheduleDay(day.weekday, {
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
                {premise.canManage && editingSlot ? (
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
          {!editingSlot ? (
            <div className="premises-rental-agreement">
              <label className="premises-checkbox">
                <input
                  type="checkbox"
                  checked={slotForm.agreementRequested}
                  onChange={(event) =>
                    setSlotForm((state) => ({
                      ...state,
                      agreementRequested: event.target.checked,
                      landlordName:
                        state.landlordName ||
                        premise.ownerTitle ||
                        premise.name,
                      tenantName:
                        state.tenantName ||
                        state.contactName ||
                        state.contactEmail,
                    }))
                  }
                />
                Оформить договор
              </label>
              {slotForm.agreementRequested ? (
                <div className="premises-rental-agreement__fields">
                  <InlineTextField
                    value={slotForm.landlordName}
                    onChange={(event) =>
                      setSlotForm((state) => ({
                        ...state,
                        landlordName: event.target.value,
                      }))
                    }
                    placeholder="Арендодатель"
                    aria-label="Наименование арендодателя"
                  />
                  <InlineTextField
                    value={slotForm.tenantName}
                    onChange={(event) =>
                      setSlotForm((state) => ({
                        ...state,
                        tenantName: event.target.value,
                      }))
                    }
                    placeholder="Арендатор"
                    aria-label="Наименование арендатора"
                  />
                  <FormTextarea
                    label="Реквизиты арендодателя"
                    value={slotForm.landlordDetails}
                    onChange={(event) =>
                      setSlotForm((state) => ({
                        ...state,
                        landlordDetails: event.target.value,
                      }))
                    }
                    rows={2}
                  />
                  <FormTextarea
                    label="Реквизиты арендатора"
                    value={slotForm.tenantDetails}
                    onChange={(event) =>
                      setSlotForm((state) => ({
                        ...state,
                        tenantDetails: event.target.value,
                      }))
                    }
                    rows={2}
                  />
                  <p className="rehearsals-muted premises-rental-agreement__hint">
                    После создания аренды появится черновик договора. Слоты
                    останутся предварительными до загрузки подписанного
                    документа.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          {premise.canManage && editingSlot ? (
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
              disabled={creatingRental || updatingSlot}
              onClick={() => void saveSlot()}
            >
              {creatingRental || updatingSlot ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
