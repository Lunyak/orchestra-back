import type { ProjectSummary } from "./project";

export type SyncOperation = "create" | "update" | "delete";

export type SyncEntityType =
  | "Project"
  | "Scene"
  | "Step"
  | "PlaylistItem"
  | "Sound"
  | "GlobalLightChannel"
  | "TheaterLayout";

export interface SyncChange {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: any;
  createdAt: string;
}

export interface SyncPushRequest {
  changes: SyncChange[];
}

export interface SyncPullRequest {
  lastSyncAt: string | null;
  projectSlug?: string;
  include?: {
    steps?: boolean;
    playlist?: boolean;
    sounds?: boolean;
    lightChannels?: boolean;
    theaterLayout?: boolean;
  };
}

export interface SyncPullResponse {
  now: string;
  projects: ProjectSummary[];
  scenes: any[];
  steps?: any[];
  playlistItems?: any[];
  sounds?: any[];
  lightChannels?: any[];
  theaterLayouts?: any[];
}
