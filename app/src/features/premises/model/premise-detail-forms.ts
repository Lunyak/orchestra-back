import dayjs from "dayjs";
import type {
  PremiseAvailabilityDay,
  PremiseBookedAsKind,
  PremiseBookingActor,
  PremiseSlotItem,
} from "../../../sync/api/premises";
import { toDatetimeLocalValue } from "./premise-utils";
import { weekDays } from "./premise-detail-options";
import type {
  AvailabilityFormDay,
  RentalScheduleFormDay,
  SlotFormState,
} from "./premise-detail-types";

export function createAvailabilityForm(
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

export function createRentalScheduleForm(dayIso: string): RentalScheduleFormDay[] {
  const selectedWeekday = dayjs(dayIso).day();
  return weekDays.map((day) => ({
    ...day,
    enabled: day.weekday === selectedWeekday,
    startsAt: "10:00",
    endsAt: "12:00",
  }));
}

export function pickDefaultBookingActor(
  actors: PremiseBookingActor[],
): PremiseBookingActor | null {
  if (actors.length === 0) return null;
  const preferred =
    actors.find((actor) => actor.kind === "theater") ??
    actors.find((actor) => actor.kind === "studio") ??
    actors.find((actor) => actor.kind === "troupe") ??
    actors.find((actor) => actor.kind === "user") ??
    actors[0];
  return preferred ?? null;
}

export function bookingActorValue(actor: PremiseBookingActor): string {
  return `${actor.kind}:${actor.id ?? ""}`;
}

export function parseBookingActorValue(value: string): {
  kind: PremiseBookedAsKind;
  id: string;
} {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex < 0) {
    return { kind: "user", id: "" };
  }
  const kind = value.slice(0, separatorIndex) as PremiseBookedAsKind;
  const id = value.slice(separatorIndex + 1);
  return { kind, id };
}

export function creatorContactDefaults(profile: {
  email?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
} | null | undefined): {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
} {
  const email = String(profile?.email ?? "").trim();
  const displayName = String(profile?.displayName ?? "").trim();
  const fullName = [profile?.firstName, profile?.lastName]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return {
    contactName: displayName || fullName,
    contactEmail: email,
    contactPhone: String(profile?.phone ?? "").trim(),
  };
}

export function emptySlotForm(
  dayIso: string,
  actors: PremiseBookingActor[] = [],
  creator?: {
    email?: string | null;
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  } | null,
): SlotFormState {
  const base = dayjs(dayIso).hour(10).minute(0).second(0).millisecond(0);
  const defaultActor = pickDefaultBookingActor(actors);
  const contact = creatorContactDefaults(creator);
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
    contactEmail: contact.contactEmail,
    contactName: contact.contactName,
    contactPhone: contact.contactPhone,
    bookedAsKind: defaultActor?.kind ?? "user",
    bookedAsId: defaultActor?.id ?? "",
    bookedAsTitle: defaultActor?.title ?? "",
    status: "confirmed",
  };
}

export function slotToForm(slot: PremiseSlotItem): SlotFormState {
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
    contactEmail: slot.contactEmail ?? "",
    contactName: slot.contactName ?? "",
    contactPhone: slot.contactPhone ?? "",
    bookedAsKind: slot.rental?.bookedAsKind ?? "user",
    bookedAsId: slot.rental?.bookedAsId ?? "",
    bookedAsTitle: slot.rental?.bookedAsTitle ?? "",
    status: slot.status,
  };
}
