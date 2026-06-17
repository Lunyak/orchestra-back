/* eslint-disable @typescript-eslint/no-explicit-any */
// Electron API (web / stub)

interface API {
  send: (channel: string, ...args: any[]) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, listener: (...args: any[]) => void) => () => void;
  off: (channel: string, listener: (...args: any[]) => void) => void;

  saveScene: (name: string, data: any) => Promise<any>;
  saveProjectScene: (
    projectName: string,
    sceneName: string,
    data: any
  ) => Promise<any>;
  saveProjectConfig: (projectName: string, config: any) => Promise<any>;
  readProjectScene: (projectName: string, sceneName: string) => Promise<any>;
  readNotesRun: (projectName: string) => Promise<any>;
  saveNotesRun: (projectName: string, data: any) => Promise<{ ok?: boolean; error?: string }>;
  pickProjectImage: (projectName: string, projectId?: string) => Promise<any>;
  addProjectImage: (
    projectName: string,
    data: ArrayBuffer | Uint8Array,
    mimeType?: string,
    originalName?: string,
    projectId?: string
  ) => Promise<any>;
  getProjectImagesBase: (projectName: string, projectId?: string) => Promise<any>;
  pickProjectAudio: (projectName: string) => Promise<any>;
  addProjectAudio: (projectName: string, filePaths: string[]) => Promise<any>;
  deleteProjectAudio: (projectName: string, file: string) => Promise<any>;
  pickProjectSound: (projectName: string) => Promise<any>;
  pickProjectModel: (projectName: string) => Promise<any>;
  pickProjectSoundIcon: (projectName: string, projectId?: string) => Promise<any>;
  deleteProjectSound: (projectName: string, file: string) => Promise<any>;
  listProjects: () => Promise<string[]>;
  createProject: (
    name: string
  ) => Promise<{ ok: boolean; name?: string; error?: string }>;
  deleteProject: (name: string) => Promise<{ ok: boolean; error?: string }>;
  pickProjectMediaFolder: (projectName: string) => Promise<any>;
  getProjectMediaFolder: (projectName: string) => Promise<any>;
  scanProjectMediaFolder: (projectName: string) => Promise<any>;

  ping: () => string;
}

declare global {
  interface Window {
    api?: API;
  }
}

export {};
