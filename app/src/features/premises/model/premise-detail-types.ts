import type { Dayjs } from "dayjs";
import type {
  PremiseAvailabilityDay,
  PremiseBookedAsKind,
  PremiseRecurrenceType,
  PremiseSlotItem,
  PremiseSlotPaymentStatus,
  PremiseSlotStatus,
  PremiseUsageType,
} from "../../../sync/api/premises";

export type PremiseTab =
  | "overview"
  | "schedule"
  | "rentals"
  | "members"
  | "settings";

export type AvailabilityFormDay = PremiseAvailabilityDay & {
  label: string;
  enabled: boolean;
};

export type RentalScheduleFormDay = {
  weekday: number;
  label: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
};

export type FreePremiseInterval = {
  startsAt: Dayjs;
  endsAt: Dayjs;
  durationMin: number;
};

export type SlotFormState = {
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
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  bookedAsKind: PremiseBookedAsKind;
  bookedAsId: string;
  bookedAsTitle: string;
  status: PremiseSlotStatus;
};

export type UpcomingSlotGroup = {
  id: string;
  label: string;
  slots: PremiseSlotItem[];
};
