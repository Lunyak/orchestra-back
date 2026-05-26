export type PremiseKind = "OWNED" | "RENTED";

export type PremiseMemberRole = "owner" | "manager" | "tenant" | "viewer";

export type PremiseSlotStatus = "confirmed" | "pending" | "cancelled";

export type PremiseSummary = {
  id: string;
  troupeId: string;
  name: string;
  kind: PremiseKind;
  address: string | null;
  capacity: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  troupeTitle: string;
  canManage: boolean;
  canBook: boolean;
  myRole: PremiseMemberRole | "troupe_owner" | null;
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
  contactEmail: string | null;
  contactName: string | null;
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
  kind?: PremiseKind;
  address?: string;
  capacity?: number;
  notes?: string;
};

export type UpdatePremisePayload = Partial<{
  name: string;
  kind: PremiseKind;
  address: string | null;
  capacity: number | null;
  notes: string | null;
}>;

export type CreatePremiseSlotPayload = {
  startsAt: string;
  durationMin: number;
  title: string;
  purpose?: string;
  rentalNotes?: string;
  contactEmail?: string;
  contactName?: string;
  status?: PremiseSlotStatus;
};

export type UpdatePremiseSlotPayload = Partial<{
  startsAt: string;
  durationMin: number;
  title: string;
  purpose: string | null;
  rentalNotes: string | null;
  contactEmail: string | null;
  contactName: string | null;
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
