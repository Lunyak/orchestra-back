import type { SessionsSideCalledStatusTone } from "./session-page-types";

export type DirectorSessionsPageOptions = {
  projectSlug?: string;
  filterByProject?: boolean;
};

export type SessionsSideCalledRow = {
  key: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  avatarLabel: string;
  statusLabel: string;
  statusTone: SessionsSideCalledStatusTone;
};
