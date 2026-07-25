import type { ScriptScene, TheaterLayout } from "../../../shared/types/script";
import type { PlaylistTrack } from "../../../shared/types/playlist";
import { DEFAULT_THEATER_LAYOUT } from "../../theater/model/theater-defaults";

export type TheaterLayoutUpdater =
  | TheaterLayout
  | ((prev: TheaterLayout) => TheaterLayout);

export { DEFAULT_THEATER_LAYOUT };

export interface PlaybookData {
  name?: string;
  scenes?: ScriptScene[];
  playlist?: PlaylistTrack[];
  sounds?: any[];
  theaterLayout?: TheaterLayout;
  roleAssignments?: Record<string, string[]>;
  sceneRoles?: PlaybookRolesDataV1;
  lightFaders?: PlaybookLightFadersDataV1;
  lightPrograms?: PlaybookLightProgramsDataV1;
  lightChannelRoles?: PlaybookLightChannelRolesV1;
  voiceLines?: SceneVoiceLines;
  images?: Record<string, { remoteKey?: string; remoteUrl?: string }>;
  videos?: PlaybookVideo[];
  holdImages?: PlaybookHoldImage[];
  projector?: SceneProjectorSettingsV1;
  lightChannels?: string[];
  lightConsoleUi?: PlaybookLightConsoleUiV1;
}

export type PlaybookLightConsoleUiV1 = {
  v: 1;
  channelColumns?: number;
};

export type SceneLightFaderLinkV1 = {
  channel: number;
  spotlightId?: number;
};

export type PlaybookLightFaderV1 = {
  id: number;
  label: string;
  channel?: number;
  spotlightId?: number;
  intensity?: number;
  enabled?: boolean;
  color?: string;
  links: SceneLightFaderLinkV1[];
};

export type PlaybookLightFadersDataV1 = {
  v: 1;
  count?: number;
  faders: PlaybookLightFaderV1[];
};

export type SceneLightProgramFaderStateV1 = {
  faderId: number;
  intensity?: number;
  enabled?: boolean;
  color?: string;
};

export type PlaybookLightProgramV1 = {
  id: number;
  label: string;
  faders: SceneLightProgramFaderStateV1[];
};

/** Память уровней F для одного канала K. */
export type PlaybookLightChannelBankV1 = {
  channel: number;
  faders: SceneLightProgramFaderStateV1[];
};

export type PlaybookLightProgramsDataV1 = {
  v: 1;
  count?: number;
  activeProgramId?: number;
  /** Пресеты П1…Пn (заливка). */
  programs: PlaybookLightProgramV1[];
  /** Память F по каналам K1…Kn (отдельно от пресетов П). */
  channels?: PlaybookLightChannelBankV1[];
};

export type PlaybookLightChannelRolesV1 = {
  v: 1;
  sofitChannels: number[];
};

export type PlaybookRoleLinkV1 = {
  roleId: string;
  roleKey?: string;
  roleTitle?: string;
  note?: string;
  createdAtIso?: string;
  updatedAtIso?: string;
};

export type PlaybookRolesDataV1 = {
  v: 1;
  bySceneId: Record<string, Record<string, PlaybookRoleLinkV1 | undefined> | undefined>;
};

export type SceneVoiceLineTake = {
  id: string;
  performerId: string;
  performerLabel?: string | null;
  createdAt: string;
  mimeType?: string;
  durationMs?: number | null;
  remoteKey?: string;
  remoteUrl?: string;
};

export type SceneVoiceLineEntry = {
  lineId: string;
  role: string;
  roleKey: string;
  takesByPerformer: Record<string, SceneVoiceLineTake[]>;
  preferredTakeIdByPerformer?: Record<string, string | undefined>;
};

export type SceneVoiceLines = {
  version: 1;
  byLineId: Record<string, SceneVoiceLineEntry | undefined>;
};

export interface PlaybookVideo {
  id: number;
  title: string;
  file: string;
  remoteUrl?: string;
  remoteKey?: string;
  filePath?: string;
}

export interface PlaybookHoldImage {
  id: number;
  title: string;
  file: string;
  remoteUrl?: string;
  remoteKey?: string;
  filePath?: string;
}

export type SceneProjectorSettingsV1 = {
  v: 1;
  defaultHoldId?: number;
  holdImageFile?: string;
  holdImageRemoteKey?: string;
  holdImageRemoteUrl?: string;
  holdImageFilePath?: string;
};

export interface SceneSound {
  id: number;
  title: string;
  file: string;
  icon?: string;
  iconRemoteKey?: string;
  iconRemoteUrl?: string;
  volume?: number;
  fadeMs?: number;
  loop?: boolean;
  restartOnStop?: boolean;
  remoteUrl?: string;
  remoteKey?: string;
  filePath?: string;
}

export interface PlaybookState {
  playbookData: PlaybookData | null;
  scenes: ScriptScene[];
  theaterLayout: TheaterLayout;
  serverShadow: {
    playbookData: PlaybookData | null;
    scenes: ScriptScene[];
    theaterLayout: TheaterLayout;
    lightChannels: string[];
  } | null;
  currentPage: number;
  isPlaybookReady: boolean;
  hasLocalEdits: boolean;
  realtimePullDeferred: boolean;
  realtimePullDeferredAt: string | null;
  realtimePullDeferredReason:
    | "local_edits"
    | "settings_pause"
    | "confirm_declined"
    | "remote_pending"
    | null;
  scenesRevision: number;
  playbookDataRevision: number;
  serverShadowRevision: number;
  soundsUpload: { uploading: boolean; error: string | null };
  playlistUpload: { uploading: boolean; error: string | null; uploadingIds: number[] };
  voiceLinesUpload: { uploading: boolean; error: string | null };
}

export const playbookInitialState: PlaybookState = {
  playbookData: null,
  scenes: [],
  theaterLayout: DEFAULT_THEATER_LAYOUT,
  serverShadow: null,
  currentPage: 0,
  isPlaybookReady: false,
  hasLocalEdits: false,
  realtimePullDeferred: false,
  realtimePullDeferredAt: null,
  realtimePullDeferredReason: null,
  scenesRevision: 0,
  playbookDataRevision: 0,
  serverShadowRevision: 0,
  soundsUpload: { uploading: false, error: null },
  playlistUpload: { uploading: false, error: null, uploadingIds: [] },
  voiceLinesUpload: { uploading: false, error: null },
};
