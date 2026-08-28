export type AccountingTab = "theaters" | "studios" | "projects";

export type TariffDraft = {
  key: string;
  title: string;
  amountRub: string;
};

export type ParticipantDraft = {
  email: string;
  selected: boolean;
  tariffIndex: number;
};

export type MemberOption = {
  email: string;
  displayName: string;
};

export type AccountingTabItem = {
  id: AccountingTab;
  label: string;
};

export type TroupeOption = {
  id: string;
  title: string;
};
