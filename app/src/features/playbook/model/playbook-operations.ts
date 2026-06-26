import { useCallback, useRef } from "react";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { flushDesktopOutbox } from "../../../sync/desktopOutbox";
import type { ProjectMediaScan } from "../../../shared/platform/project-media-folder";
import type { BrowserPickedScan } from "../../../shared/platform/browser-picked-media";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { useAuth } from "../../auth/model/auth-context";
import { useProject } from "../../project/model/project-context";
import { downloadPlaybookProjectorMediaForOffline } from "./playbook-download-projector-offline";
import { importPlaybookDevMediaFolder } from "./playbook-import-dev-media";
import { savePlaybookScenesForLightPlot } from "./playbook-save-scenes";
import { syncPlaybookFromServer } from "./playbook-sync-from-server";

export function usePlaybookOperations() {
  const dispatch = useAppDispatch();
  const { accessToken, setAccessToken } = useAuth();
  const { projectName, ensureRemoteProject } = useProject();

  const { scenes } = useAppSelector((s) => s.playbook);
  const saveScenesRef = useRef<(opts?: { force?: boolean }) => Promise<void>>(async () => {});

  const syncDeps = {
    dispatch,
    accessToken,
    projectName,
    scenes,
    ensureRemoteProject,
    setAccessToken,
    onBindingsRepaired: () => {
      void saveScenesRef.current({ force: true });
    },
  };

  const saveDeps = {
    projectName,
    accessToken,
    ensureRemoteProject,
    dispatch,
  };

  const syncFromServer = useCallback(
    async (token?: string | null, projectOverride?: string) => {
      await syncPlaybookFromServer(syncDeps, token, projectOverride);
    },
    [accessToken, projectName, ensureRemoteProject, setAccessToken, dispatch, scenes],
  );

  const saveScenesForLightPlot = useCallback(
    async (opts?: { force?: boolean }) => {
      await savePlaybookScenesForLightPlot(saveDeps, opts);
    },
    [projectName, accessToken, ensureRemoteProject, dispatch],
  );

  saveScenesRef.current = saveScenesForLightPlot;

  const pushPlaybookAfterSoundsSave = useCallback(async () => {
    const desktopApi = getDesktopApi();
    if (desktopApi) {
      const token = accessToken ?? localStorage.getItem("accessToken");
      if (!token || !projectName) return;
      try {
        await flushDesktopOutbox(token, projectName);
      } catch (error) {
        console.error("[sync] desktop outbox flush after sounds save failed:", error);
      }
      return;
    }
    if (!projectName) return;
    try {
      await saveScenesForLightPlot({ force: true });
    } catch (error) {
      console.error("[sync] web sounds save failed:", error);
    }
  }, [accessToken, projectName, saveScenesForLightPlot]);

  const downloadProjectorMediaForOffline = useCallback(
    async (opts?: {
      onProgress?: (current: number, total: number, label: string) => void;
    }) => downloadPlaybookProjectorMediaForOffline(dispatch, projectName, accessToken, opts),
    [accessToken, dispatch, projectName],
  );

  const syncAndDownloadProjectorMediaForOffline = useCallback(
    async (opts?: {
      onProgress?: (current: number, total: number, label: string) => void;
    }) => {
      const tokenToUse =
        accessToken ??
        (typeof window !== "undefined" ? localStorage.getItem("accessToken") : null);
      if (tokenToUse && projectName && typeof navigator !== "undefined" && navigator.onLine) {
        await syncFromServer(tokenToUse, projectName);
      }
      await saveScenesRef.current({ force: true });
      return downloadProjectorMediaForOffline(opts);
    },
    [accessToken, downloadProjectorMediaForOffline, projectName, syncFromServer],
  );

  const importDevMediaFolder = useCallback(
    async (opts?: {
      force?: boolean;
      scanned?: ProjectMediaScan | BrowserPickedScan;
      pickIfMissing?: boolean;
    }) => importPlaybookDevMediaFolder(dispatch, projectName, opts),
    [dispatch, projectName],
  );

  return {
    syncFromServer,
    saveScenesForLightPlot,
    pushPlaybookAfterSoundsSave,
    downloadProjectorMediaForOffline,
    syncAndDownloadProjectorMediaForOffline,
    importDevMediaFolder,
  };
}
