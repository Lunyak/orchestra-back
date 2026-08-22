export type PremiseKind = "OWNED" | "RENTED";

export type PremiseMemberRole = "owner" | "manager" | "tenant" | "viewer";

export type PremiseBookedAsKind =
  | "user"
  | "troupe"
  | "theater"
  | "studio"
  | "external";

export type PremiseSlotStatus = "confirmed" | "pending" | "cancelled";
export type PremiseSlotPaymentStatus = "unpaid" | "paid" | "waived";
export type PremiseUsageType = "internal" | "friendly" | "commercial";
export type PremiseRecurrenceType = "once" | "weekly";
export type PremiseRentalStatus =
  | "pending"
  | "active"
  | "cancelled"
  | "completed";
export type PremiseAgreementStatus =
  | "draft"
  | "awaiting_signature"
  | "active"
  | "terminated"
  | "expired";

export type PremiseAvailabilityDay = {
  weekday: number;
  startsAtMin: number;
  endsAtMin: number;
};

export type PremiseBookingActor = {
  kind: PremiseBookedAsKind;
  id: string | null;
  title: string;
};

export type PremiseBookedAs = {
  kind: PremiseBookedAsKind;
  id: string | null;
  title: string;
};

export type PremiseSummary = {
  id: string;
  troupeId: string | null;
  theaterId: string | null;
  studioId: string | null;
  name: string;
  kind: PremiseKind;
  address: string | null;
  capacity: number | null;
  weeklyAvailability: PremiseAvailabilityDay[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  ownerTitle: string;
  canManage: boolean;
  canBook: boolean;
  myRole: PremiseMemberRole | "organization_admin" | null;
  bookingActors?: PremiseBookingActor[];
};

export type PremiseMemberItem = {
  id: string;
  premiseId: string;
  email: string;
  role: PremiseMemberRole;
  canBook: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PremiseSlotItem = {
  id: string;
  premiseId: string;
  rentalId: string | null;
  startsAt: string;
  durationMin: number;
  title: string;
  purpose: string | null;
  rentalNotes: string | null;
  rentalAmountKopecks: number | null;
  rentalAmountRub: number | null;
  paymentStatus: PremiseSlotPaymentStatus;
  contactEmail: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: PremiseSlotStatus;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  rental: {
    id: string;
    usageType: PremiseUsageType;
    recurrenceType: PremiseRecurrenceType;
    agreementRequested: boolean;
    status: PremiseRentalStatus;
    bookedAsKind: PremiseBookedAsKind;
    bookedAsId: string | null;
    bookedAsTitle: string;
    createdByEmail: string;
    confirmedByEmail: string | null;
    confirmedAt: string | null;
    agreement: {
      id: string;
      number: string;
      status: PremiseAgreementStatus;
    } | null;
  } | null;
};

export type PremiseRentalItem = {
  id: string;
  premiseId: string;
  usageType: PremiseUsageType;
  recurrenceType: PremiseRecurrenceType;
  title: string;
  purpose: string | null;
  rentalNotes: string | null;
  contactEmail: string | null;
  contactName: string | null;
  contactPhone: string | null;
  bookedAsKind: PremiseBookedAsKind;
  bookedAsId: string | null;
  bookedAsTitle: string;
  startsOn: string;
  endsOn: string | null;
  timezoneOffsetMin: number;
  monthlyAmountKopecks: number | null;
  monthlyAmountRub: number | null;
  paymentDueDay: number | null;
  agreementRequested: boolean;
  status: PremiseRentalStatus;
  createdByEmail: string;
  confirmedByEmail: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  schedules: {
    id: string;
    weekday: number;
    startsAtMin: number;
    durationMin: number;
  }[];
  agreement: {
    id: string;
    number: string;
    status: PremiseAgreementStatus;
    landlordName: string;
    landlordDetails: string | null;
    tenantName: string;
    tenantDetails: string | null;
    signedAt: string | null;
    createdAt: string;
    updatedAt: string;
    documents: {
      id: string;
      kind: "generated" | "uploaded" | "signed";
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: string;
    }[];
  } | null;
  payments: {
    id: string;
    periodStart: string;
    dueAt: string;
    amountKopecks: number;
    amountRub: number;
    status: "unpaid" | "paid" | "waived";
    paidAt: string | null;
  }[];
};

export type PremisesListResponse = {
  premises: PremiseSummary[];
};

export type PremiseSlotsResponse = {
  slots: PremiseSlotItem[];
};

export type PremiseMembersResponse = {
  members: PremiseMemberItem[];
};

export type PremiseRentalsResponse = {
  rentals: PremiseRentalItem[];
};

export type CreatePremisePayload = {
  name: string;
  theaterId?: string;
  studioId?: string;
  kind?: PremiseKind;
  address?: string;
  capacity?: number;
  weeklyAvailability?: PremiseAvailabilityDay[];
  notes?: string;
};

export type UpdatePremisePayload = Partial<{
  name: string;
  kind: PremiseKind;
  address: string | null;
  capacity: number | null;
  weeklyAvailability: PremiseAvailabilityDay[];
  notes: string | null;
}>;

export type CreatePremiseSlotPayload = {
  startsAt: string;
  durationMin: number;
  title: string;
  purpose?: string;
  rentalNotes?: string;
  rentalAmountRub?: number;
  paymentStatus?: PremiseSlotPaymentStatus;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  status?: PremiseSlotStatus;
};

export type UpdatePremiseSlotPayload = Partial<{
  startsAt: string;
  durationMin: number;
  title: string;
  purpose: string | null;
  rentalNotes: string | null;
  rentalAmountRub: number | null;
  paymentStatus: PremiseSlotPaymentStatus;
  contactEmail: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: PremiseSlotStatus;
}>;

export type CreatePremiseRentalAgreementPayload = {
  landlordName?: string;
  landlordDetails?: string;
  tenantName?: string;
  tenantDetails?: string;
};

export type CreatePremiseRentalPayload = {
  usageType: PremiseUsageType;
  recurrenceType: PremiseRecurrenceType;
  title: string;
  purpose?: string;
  rentalNotes?: string;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  bookedAsKind?: PremiseBookedAsKind;
  bookedAsId?: string;
  bookedAsTitle?: string;
  startsOn: string;
  endsOn?: string;
  indefinite?: boolean;
  startsAt?: string;
  timezoneOffsetMin?: number;
  durationMin?: number;
  schedules?: {
    weekday: number;
    startsAtMin: number;
    durationMin: number;
  }[];
  amountRub?: number;
  monthlyAmountRub?: number;
  paymentDueDay?: number;
  agreementRequested?: boolean;
  landlordName?: string;
  landlordDetails?: string;
  tenantName?: string;
  tenantDetails?: string;
};

export type AddPremiseMemberPayload = {
  email: string;
  role?: PremiseMemberRole;
  canBook?: boolean;
};

export type UpdatePremiseMemberPayload = Partial<{
  role: PremiseMemberRole;
  canBook: boolean;
}>;
