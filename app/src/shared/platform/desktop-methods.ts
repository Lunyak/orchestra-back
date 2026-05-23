import type {
  PlatformApi,
  PlatformInvokeResult,
  PlatformPickAudioResult,
  PlatformPickSoundIconResult,
  PlatformPickSoundResult,
  PlatformSceneSaveResult,
  PlatformAddProjectImageResult,
  PlatformPickModelResult,
} from "./platform-api";
import { requireDesktopApi } from "./desktop-api";

function fn<T extends (...args: never[]) => unknown>(
  api: PlatformApi,
  pick: (a: PlatformApi) => T | undefined,
  label: string,
): T {
  const f = pick(api);
  if (typeof f !== "function") {
    throw new Error(`Desktop API: ${label} is unavailable`);
  }
  return f;
}

export function desktopReadProjectScene(
  api: PlatformApi,
  projectName: string,
  sceneName: string,
): Promise<unknown> {
  return fn(api, (a) => a.readProjectScene, "readProjectScene")(projectName, sceneName);
}

export function desktopSaveProjectScene(
  api: PlatformApi,
  projectName: string,
  sceneName: string,
  data: unknown,
  options?: unknown,
): Promise<PlatformSceneSaveResult> {
  return fn(api, (a) => a.saveProjectScene, "saveProjectScene")(
    projectName,
    sceneName,
    data,
    options,
  );
}

export function desktopPickProjectSound(
  api: PlatformApi,
  projectName: string,
): Promise<PlatformPickSoundResult> {
  return fn(api, (a) => a.pickProjectSound, "pickProjectSound")(projectName);
}

export function desktopPickProjectAudio(
  api: PlatformApi,
  projectName: string,
): Promise<PlatformPickAudioResult> {
  return fn(api, (a) => a.pickProjectAudio, "pickProjectAudio")(projectName);
}

export function desktopAddProjectAudio(
  api: PlatformApi,
  projectName: string,
  filePaths: string[],
): Promise<PlatformPickAudioResult> {
  return fn(api, (a) => a.addProjectAudio, "addProjectAudio")(projectName, filePaths);
}

export function desktopDeleteProjectAudio(
  api: PlatformApi,
  projectName: string,
  file: string,
): Promise<PlatformInvokeResult> {
  return fn(api, (a) => a.deleteProjectAudio, "deleteProjectAudio")(projectName, file);
}

export async function desktopReadProjectSceneRequired(
  projectName: string,
  sceneName: string,
): Promise<unknown> {
  return desktopReadProjectScene(requireDesktopApi(), projectName, sceneName);
}

export function desktopPickProjectSoundIcon(
  api: PlatformApi,
  projectName: string,
  projectId?: string,
): Promise<PlatformPickSoundIconResult> {
  return fn(api, (a) => a.pickProjectSoundIcon, "pickProjectSoundIcon")(
    projectName,
    projectId,
  );
}

export function desktopDeleteProjectSound(
  api: PlatformApi,
  projectName: string,
  file: string,
): Promise<PlatformInvokeResult> {
  return fn(api, (a) => a.deleteProjectSound, "deleteProjectSound")(projectName, file);
}

export function desktopPickProjectModel(
  api: PlatformApi,
  projectName: string,
): Promise<PlatformPickModelResult> {
  return fn(api, (a) => a.pickProjectModel, "pickProjectModel")(projectName);
}

export function desktopAddProjectImage(
  api: PlatformApi,
  projectName: string,
  data: ArrayBuffer | Uint8Array,
  mimeType?: string,
  originalName?: string,
  projectId?: string,
): Promise<PlatformAddProjectImageResult> {
  return fn(api, (a) => a.addProjectImage, "addProjectImage")(
    projectName,
    data,
    mimeType,
    originalName,
    projectId,
  );
}

export async function desktopSaveProjectSceneRequired(
  projectName: string,
  sceneName: string,
  data: unknown,
  options?: unknown,
): Promise<PlatformSceneSaveResult> {
  return desktopSaveProjectScene(requireDesktopApi(), projectName, sceneName, data, options);
}
