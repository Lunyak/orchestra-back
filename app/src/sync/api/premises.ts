export type PremiseKind = "OWNED" | "RENTED";

export type PremiseMemberRole = "owner" | "manager" | "tenant" | "viewer";

export type PremiseSlotStatus = "confirmed" | "pending" | "cancelled";
export type PremiseSlotPaymentStatus = "unpaid" | "paid" | "waived";

export type PremiseSummary = {
  id: string;
  troupeId: string | null;
  theaterId: string | null;
  studioId: string | null;
  name: string;
  kind: PremiseKind;
  address: string | null;
  capacity: number | null;
  paymentDueDay: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  ownerTitle: string;
  canManage: boolean;
  canBook: boolean;
  myRole: PremiseMemberRole | "organization_admin" | null;
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

export type CreatePremisePayload = {
  name: string;
  theaterId?: string;
  studioId?: string;
  kind?: PremiseKind;
  address?: string;
  capacity?: number;
  paymentDueDay?: number;
  notes?: string;
};

export type UpdatePremisePayload = Partial<{
  name: string;
  kind: PremiseKind;
  address: string | null;
  capacity: number | null;
  paymentDueDay: number | null;
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

export type AddPremiseMemberPayload = {
  email: string;
  role?: PremiseMemberRole;
  canBook?: boolean;
};

export type UpdatePremiseMemberPayload = Partial<{
  role: PremiseMemberRole;
  canBook: boolean;
}>;
