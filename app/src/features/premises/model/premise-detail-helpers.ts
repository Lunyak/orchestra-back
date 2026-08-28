import type { CalendarSectionState } from "@shared/components/calendar/CalendarSection";
import dayjs from "dayjs";
import type { TeamProfile } from "../../../sync/api/profile";
import type {
  CreatePremiseRentalPayload,
  CreatePremiseSlotPayload,
  PremiseAvailabilityDay,
  PremiseKind,
  PremiseMemberItem,
  PremiseRentalItem,
  PremiseSlotItem,
  PremiseSummary,
  UpdatePremisePayload,
  UpdatePremiseSlotPayload,
} from "../../../sync/api/premises";
import { agreementStatusLabel } from "./premise-detail-options";
import type {
  AvailabilityFormDay,
  FreePremiseInterval,
  SlotFormState,
  UpcomingSlotGroup,
} from "./premise-detail-types";
import { fromDatetimeLocalValue, monthRangeIso } from "./premise-utils";

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

export function timeToMinutes(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function formatDuration(durationMin: number): string {
  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  const parts = [
    hours ? `${hours} ч` : "",
    minutes ? `${minutes} мин` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

export function slotBookingRentalId(slot: PremiseSlotItem): string | null {
  return slot.rentalId ?? slot.rental?.id ?? null;
}

export function rentalContactLabel(rental: PremiseRentalItem): string {
  return [rental.contactName, rental.contactPhone, rental.contactEmail]
    .filter(Boolean)
    .join(" · ");
}

export function formatRentalDate(value: string): string {
  return dayjs(value.slice(0, 10)).format("D MMM YYYY");
}

export function groupUpcomingSlots(slots: PremiseSlotItem[]): UpcomingSlotGroup[] {
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

export function buildCancelRentalWarning(rental: PremiseRentalItem): string {
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

export function formatRubles(amountRub: number): string {
  return `${amountRub.toLocaleString("ru-RU")} ₽`;
}

export function getPremiseSlotActorLabel(
  slot: PremiseSlotItem,
  profileByEmail: Map<string, TeamProfile>,
): string {
  const rental = slot.rental;
  const bookedTitle = String(rental?.bookedAsTitle ?? "").trim();
  const bookedKind = rental?.bookedAsKind ?? "user";
  const isOrgBooking = bookedKind !== "user" && Boolean(bookedTitle);
  if (isOrgBooking) return bookedTitle;

  const createdByEmail =
    rental?.createdByEmail?.trim() || slot.createdByEmail.trim();
  if (!createdByEmail) return bookedTitle;

  const profile = profileByEmail.get(normalizeMemberEmail(createdByEmail));
  const { name } = resolvePremiseMemberLabel(createdByEmail, profile);
  return bookedTitle || name;
}

export function getOrganizationInitials(title: string): string {
  return title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("ru-RU");
}

export function normalizeMemberEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resolvePremiseMemberLabel(
  email: string,
  profile: TeamProfile | undefined,
): { name: string; secondary: string | null } {
  const displayName = String(profile?.displayName ?? "").trim();
  if (displayName) {
    return { name: displayName, secondary: email };
  }
  const fullName = [profile?.firstName, profile?.lastName]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) {
    return { name: fullName, secondary: email };
  }
  return { name: email, secondary: null };
}

export function calculateFreeIntervals(
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

export function extractError(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "data" in e) {
    const msg = (e as { data?: { message?: string } }).data?.message;
    if (msg) return String(msg);
  }
  return fallback;
}

export function buildPremiseSlotsQueryRange(
  calendarState: CalendarSectionState | null,
): { from: string; to: string } {
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
}

export function collectMemberEmails(
  members: PremiseMemberItem[] | undefined,
): string[] {
  const unique = new Set<string>();
  for (const member of members ?? []) {
    const email = normalizeMemberEmail(member.email);
    if (email) unique.add(email);
  }
  return Array.from(unique).sort();
}

export function collectSlotPeopleEmails(
  slots: PremiseSlotItem[] | undefined,
  rentals: PremiseRentalItem[] | undefined,
): string[] {
  const unique = new Set<string>();
  for (const slot of slots ?? []) {
    const createdBy =
      slot.rental?.createdByEmail?.trim() || slot.createdByEmail.trim();
    if (createdBy) unique.add(normalizeMemberEmail(createdBy));
    const confirmedBy = slot.rental?.confirmedByEmail?.trim();
    if (confirmedBy) unique.add(normalizeMemberEmail(confirmedBy));
  }
  for (const rental of rentals ?? []) {
    const createdBy = rental.createdByEmail.trim();
    if (createdBy) unique.add(normalizeMemberEmail(createdBy));
    const confirmedBy = rental.confirmedByEmail?.trim();
    if (confirmedBy) unique.add(normalizeMemberEmail(confirmedBy));
  }
  return Array.from(unique).sort();
}

export function mergeUniqueEmails(...groups: string[][]): string[] {
  const unique = new Set<string>();
  for (const group of groups) {
    for (const email of group) unique.add(email);
  }
  return Array.from(unique).sort();
}

export function buildMemberProfileByEmail(
  profiles: TeamProfile[],
): Map<string, TeamProfile> {
  const map = new Map<string, TeamProfile>();
  for (const profile of profiles) {
    const email = normalizeMemberEmail(profile.email);
    if (email) map.set(email, profile);
  }
  return map;
}

export function filterActiveSlots(slots: PremiseSlotItem[]): PremiseSlotItem[] {
  return slots.filter((slot) => slot.status !== "cancelled");
}

export function filterPendingSlots(slots: PremiseSlotItem[]): PremiseSlotItem[] {
  return slots.filter((slot) => slot.status === "pending");
}

export function filterTodaySlots(slots: PremiseSlotItem[]): PremiseSlotItem[] {
  return slots.filter((slot) => dayjs(slot.startsAt).isSame(dayjs(), "day"));
}

export function computeOccupiedHours(slots: PremiseSlotItem[]): number {
  return slots.reduce((total, slot) => total + slot.durationMin / 60, 0);
}

export function computeOccupiedDays(slots: PremiseSlotItem[]): number {
  return new Set(
    slots.map((slot) => dayjs(slot.startsAt).format("YYYY-MM-DD")),
  ).size;
}

export function computeUnpaidAmountRub(slots: PremiseSlotItem[]): number {
  return slots.reduce(
    (total, slot) =>
      slot.paymentStatus === "unpaid"
        ? total + (slot.rentalAmountRub ?? 0)
        : total,
    0,
  );
}

export function canEditPremiseSlot(
  premise: PremiseSummary | undefined,
  slot: PremiseSlotItem,
  userEmail: string,
): boolean {
  if (!premise) return false;
  if (premise.canManage) return true;
  if (!premise.canBook) return false;
  const me = userEmail.trim().toLowerCase();
  return (
    slot.createdByEmail.trim().toLowerCase() === me ||
    (slot.contactEmail?.trim().toLowerCase() ?? "") === me
  );
}

export function validateSlotForm(
  slotForm: SlotFormState,
  editingSlot: PremiseSlotItem | null,
): string | null {
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
  if (
    !slotForm.title.trim() ||
    (needsOneTimeDuration &&
      (!Number.isFinite(durationMin) || durationMin < 1)) ||
    hasInvalidAmount ||
    hasInvalidPaymentDay ||
    hasInvalidPeriod ||
    (isRecurring && (enabledSchedules.length === 0 || hasInvalidSchedule)) ||
    (isCommercial && rentalAmountRub == null) ||
    (isCommercial && isRecurring && paymentDueDay == null)
  ) {
    return "Проверьте обязательные поля аренды и расписание";
  }
  return null;
}

export function buildEnabledSchedules(slotForm: SlotFormState) {
  return slotForm.schedules
    .filter((day) => day.enabled)
    .map((day) => ({
      weekday: day.weekday,
      startsAtMin: timeToMinutes(day.startsAt),
      durationMin: timeToMinutes(day.endsAt) - timeToMinutes(day.startsAt),
    }));
}

export function buildSlotUpdatePayload(
  slotForm: SlotFormState,
  canManagePremise: boolean,
): UpdatePremiseSlotPayload {
  const durationMin = Number(slotForm.durationMin);
  const rentalAmountRub = slotForm.rentalAmountRub
    ? Number(slotForm.rentalAmountRub)
    : null;
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
  return {
    ...slotBody,
    ...(canManagePremise
      ? {
          rentalAmountRub,
        }
      : {}),
  };
}

export function buildCreateRentalPayload(
  slotForm: SlotFormState,
): CreatePremiseRentalPayload {
  const durationMin = Number(slotForm.durationMin);
  const rentalAmountRub = slotForm.rentalAmountRub
    ? Number(slotForm.rentalAmountRub)
    : null;
  const paymentDueDay = slotForm.paymentDueDay
    ? Number(slotForm.paymentDueDay)
    : null;
  const enabledSchedules = buildEnabledSchedules(slotForm);
  const isRecurring = slotForm.recurrenceType === "weekly";
  const isCommercial = slotForm.usageType === "commercial";
  const startsOn = isRecurring
    ? slotForm.periodStartsOn
    : slotForm.startsAtLocal.slice(0, 10);
  return {
    usageType: slotForm.usageType,
    recurrenceType: slotForm.recurrenceType,
    title: slotForm.title.trim(),
    purpose: slotForm.purpose.trim() || undefined,
    rentalNotes: slotForm.rentalNotes.trim() || undefined,
    contactEmail: slotForm.contactEmail.trim() || undefined,
    contactName: slotForm.contactName.trim() || undefined,
    contactPhone: slotForm.contactPhone.trim() || undefined,
    bookedAsKind: slotForm.bookedAsKind,
    ...(slotForm.bookedAsId ? { bookedAsId: slotForm.bookedAsId } : {}),
    ...(slotForm.bookedAsKind === "external"
      ? {
          bookedAsTitle:
            slotForm.bookedAsTitle.trim() ||
            slotForm.contactName.trim() ||
            undefined,
        }
      : {}),
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
  };
}

export function validateSettingsForm(input: {
  name: string;
  capacity: string;
  availability: AvailabilityFormDay[];
}): string | null {
  const name = input.name.trim();
  const capacity = input.capacity ? Number(input.capacity) : null;
  const weeklyAvailability = input.availability
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
    return "Проверьте название, вместимость и рабочее время";
  }
  return null;
}

export function buildUpdatePremiseBody(input: {
  name: string;
  kind: PremiseKind;
  address: string;
  capacity: string;
  availability: AvailabilityFormDay[];
  notes: string;
}): UpdatePremisePayload {
  const capacity = input.capacity ? Number(input.capacity) : null;
  const weeklyAvailability = input.availability
    .filter((day) => day.enabled)
    .map(({ weekday, startsAtMin, endsAtMin }) => ({
      weekday,
      startsAtMin,
      endsAtMin,
    }));
  return {
    name: input.name.trim(),
    kind: input.kind,
    address: input.address.trim() || null,
    capacity,
    weeklyAvailability,
    notes: input.notes.trim() || null,
  };
}

export function applyFreeIntervalToSlotForm(
  form: SlotFormState,
  interval: FreePremiseInterval,
): SlotFormState {
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
  return {
    ...form,
    startsAtLocal: interval.startsAt.format("YYYY-MM-DDTHH:mm"),
    durationMin: String(interval.durationMin),
    schedules,
  };
}
