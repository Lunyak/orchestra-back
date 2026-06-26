import { Capacitor } from "@capacitor/core";
import {
  downloadRemoteAsset,
  mobileInvoke,
  readProjectPlaybook,
  resolveFileSrc,
  saveProjectPlaybook,
} from "./storage";

let initialized = false;

/** Регистрирует window.api для офлайн-хранилища (как Electron desktop). */
export async function initCapacitorPlatform(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;

  const api = {
    invoke: mobileInvoke,
    readProjectPlaybook,
    saveProjectPlaybook,
    resolveFileSrc,
    downloadRemoteAsset,
    isCapacitor: true as const,
  };

  (window as any).api = api;
  console.info("[orchestra] Capacitor offline platform ready");
}
