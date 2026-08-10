export type CollectionScope = "troupe" | "studio";

export type TroupeCollectionStatus = "draft" | "active" | "closed";

export interface CollectionTariffItem {
  id: string;
  title: string;
  amountKopecks: number;
  amountRub: number;
  sortOrder: number;
}

export interface CollectionParticipantItem {
  id: string;
  email: string;
  displayName: string;
  tariffId: string;
  tariffTitle: string;
  expectedKopecks: number;
  expectedRub: number;
  paidKopecks: number;
  paidRub: number;
  remainingKopecks: number;
  remainingRub: number;
  isPaid: boolean;
}

export interface CollectionContributionItem {
  id: string;
  email: string;
  amountKopecks: number;
  amountRub: number;
  paidAt: string;
  recordedByEmail: string;
  note: string | null;
  createdAt: string;
}

export interface CollectionSummary {
  id: string;
  scope: CollectionScope;
  troupeId: string;
  troupeTitle: string;
  studioId: string | null;
  studioTitle: string | null;
  theaterId: string | null;
  title: string;
  description: string | null;
  status: TroupeCollectionStatus;
  dueAt: string | null;
  premiseId: string | null;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  tariffCount: number;
  participantCount: number;
  paidParticipantCount: number;
  expectedKopecks: number;
  expectedRub: number;
  paidKopecks: number;
  paidRub: number;
  canManage: boolean;
}

export interface CollectionDetail extends CollectionSummary {
  tariffs: CollectionTariffItem[];
  participants: CollectionParticipantItem[];
  contributions: CollectionContributionItem[];
  myParticipant: CollectionParticipantItem | null;
  canRecordForOthers: boolean;
  canRecordSelf: boolean;
  smtpConfigured: boolean;
  canSendReminders: boolean;
}

export interface AccountingMemberOption {
  email: string;
  displayName: string;
}

export interface AccountingScopeTheater {
  id: string;
  title: string;
  troupes: Array<{ id: string; title: string }>;
}

export interface AccountingScopeStudio {
  id: string;
  title: string;
}

export interface AccountingScopeProject {
  id: string;
  slug: string;
  name: string;
  troupeIds: string[];
}

export interface AccountingScopes {
  theaters: AccountingScopeTheater[];
  studios: AccountingScopeStudio[];
  projects: AccountingScopeProject[];
}

export interface CollectionsListResponse {
  collections: CollectionSummary[];
  canCreateCollections: boolean;
  createMemberOptions: AccountingMemberOption[];
  scopes: AccountingScopes;
  smtpConfigured: boolean;
}

export interface RemindDebtorsResponse {
  ok: true;
  sent: number;
  failed: number;
  errors?: string[];
}

export interface CreateCollectionTariffPayload {
  title: string;
  amountRub: number;
}

export interface CreateCollectionParticipantPayload {
  email: string;
  tariffIndex: number;
}

export interface CreateCollectionPayload {
  title: string;
  description?: string;
  dueAt?: string;
  premiseId?: string;
  troupeId?: string;
  studioId?: string;
  tariffs: CreateCollectionTariffPayload[];
  participants: CreateCollectionParticipantPayload[];
}

export interface UpdateCollectionPayload {
  title?: string;
  description?: string | null;
  status?: TroupeCollectionStatus;
  dueAt?: string | null;
  premiseId?: string | null;
}

export interface SetCollectionTariffPayload {
  id?: string;
  title: string;
  amountRub: number;
}

export interface SetCollectionParticipantsPayload {
  email: string;
  tariffId: string;
}

export interface CreateContributionPayload {
  email: string;
  amountRub: number;
  paidAt?: string;
  note?: string;
}

export function collectionStatusLabel(status: TroupeCollectionStatus): string {
  if (status === "draft") return "Черновик";
  if (status === "closed") return "Закрыт";
  return "Активен";
}

export function collectionOwnerLabel(collection: CollectionSummary): string {
  if (collection.scope === "studio") {
    return collection.studioTitle || "Студия";
  }
  return collection.troupeTitle || "Труппа";
}
