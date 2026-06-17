/** Typed bridge for Electron desktop and Capacitor mobile (`window.api`). */

export type PlatformInvokeResult = { ok?: boolean; error?: string; canceled?: boolean };

export type PlatformSceneSaveResult = { ok?: boolean; error?: string };

export type PlatformAudioTrack = {
  title?: string;
  file?: string;
  filePath?: string;
};

export type PlatformPickAudioResult = PlatformInvokeResult & {
  tracks?: PlatformAudioTrack[];
};

export type PlatformPickSoundResult = PlatformInvokeResult & {
  tracks?: PlatformAudioTrack[];
};

export type PlatformPickSoundIconResult = PlatformInvokeResult & {
  file?: string;
  filePath?: string;
};

export type PlatformOutboxListResult = PlatformInvokeResult & {
  items?: Array<{ id?: string; payload?: unknown }>;
};

export type PlatformPickModelResult = PlatformInvokeResult & {
  name?: string;
  file?: string;
  filePath?: string;
};

export type PlatformAddProjectImageResult = PlatformInvokeResult & {
  file?: string;
  filePath?: string;
  markdownPath?: string;
  remoteKey?: string;
  remoteUrl?: string;
};

export interface PlatformApi {
  invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>;
  readProjectScene: (projectName: string, sceneName: string) => Promise<unknown>;
  /** Локальная «Запись» — отдельный файл, не участвует в sync. */
  readNotesRun?: (projectName: string) => Promise<unknown>;
  saveNotesRun?: (projectName: string, data: unknown) => Promise<PlatformSceneSaveResult>;
  saveProjectScene?: (
    projectName: string,
    sceneName: string,
    data: unknown,
    options?: unknown,
  ) => Promise<PlatformSceneSaveResult>;
  outboxList?: (projectName: string, limit?: number) => Promise<PlatformOutboxListResult>;
  listProjects?: () => Promise<string[]>;
  createProject?: (name: string) => Promise<{ ok: boolean; name?: string; error?: string }>;
  deleteProject?: (name: string) => Promise<{ ok: boolean; error?: string }>;
  pickProjectSound?: (projectName: string) => Promise<PlatformPickSoundResult>;
  pickProjectSoundIcon?: (
    projectName: string,
    projectId?: string,
  ) => Promise<PlatformPickSoundIconResult>;
  pickProjectAudio?: (projectName: string) => Promise<PlatformPickAudioResult>;
  addProjectAudio?: (
    projectName: string,
    filePaths: string[],
  ) => Promise<PlatformPickAudioResult>;
  deleteProjectAudio?: (projectName: string, file: string) => Promise<PlatformInvokeResult>;
  deleteProjectSound?: (projectName: string, file: string) => Promise<PlatformInvokeResult>;
  pickProjectModel?: (projectName: string) => Promise<PlatformPickModelResult>;
  pickProjectMediaFolder?: (
    projectName: string,
  ) => Promise<
    PlatformInvokeResult & {
      path?: string;
      label?: string;
      mediaRoot?: string;
      videos?: Array<{ id: number; title: string; file: string; filePath?: string }>;
      holdImages?: Array<{ id: number; title: string; file: string; filePath?: string }>;
      sounds?: Array<{ id: number; title: string; file: string; filePath?: string }>;
    }
  >;
  getProjectMediaFolder?: (
    projectName: string,
  ) => Promise<PlatformInvokeResult & { path?: string; label?: string }>;
  scanProjectMediaFolder?: (
    projectName: string,
  ) => Promise<
    PlatformInvokeResult & {
      mediaRoot?: string;
      videos?: Array<{ id: number; title: string; file: string; filePath?: string }>;
      holdImages?: Array<{ id: number; title: string; file: string; filePath?: string }>;
      sounds?: Array<{ id: number; title: string; file: string; filePath?: string }>;
    }
  >;
  addProjectImage?: (
    projectName: string,
    data: ArrayBuffer | Uint8Array,
    mimeType?: string,
    originalName?: string,
    projectId?: string,
  ) => Promise<PlatformAddProjectImageResult>;
  outboxAck?: (ids: string[]) => Promise<PlatformInvokeResult>;
  /** Desktop: custom protocol URL; mobile: absolute path → file src. */
  resolveFileSrc?: (
    projectNameOrPath: string,
    relativePath?: string,
  ) => string | Promise<string | null>;
  downloadRemoteAsset?: (...args: unknown[]) => Promise<unknown>;
  isCapacitor?: true;
}

declare global {
  interface Window {
    api?: PlatformApi;
  }
}
