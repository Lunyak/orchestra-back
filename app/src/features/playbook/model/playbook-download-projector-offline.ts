import { getDesktopApi } from "../../../shared/platform/desktop-api";
import type { AppDispatch } from "../../../shared/store/store";
import { downloadDesktopProjectorMediaOffline } from "../../../sync/desktopProjectorMediaOffline";
import { playbookActions } from "./playbook-slice";

export async function downloadPlaybookProjectorMediaForOffline(
  dispatch: AppDispatch,
  projectName: string,
  accessToken: string | null,
  opts?: {
    onProgress?: (current: number, total: number, label: string) => void;
  },
) {
  if (!projectName) {
    throw new Error("Выберите проект");
  }
  if (!getDesktopApi()?.invoke) {
    throw new Error("Скачивание доступно только в десктоп-приложении");
  }
  const tokenToUse =
    accessToken ??
    (typeof window !== "undefined" ? localStorage.getItem("accessToken") : null);
  const projectId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectName}`) : null;
  const result = await downloadDesktopProjectorMediaOffline({
    projectSlug: projectName,
    accessToken: tokenToUse,
    projectId,
    onProgress: opts?.onProgress,
  });
  if (result.changed) {
    dispatch(
      playbookActions.setProjectorMediaLibrary({
        videos: result.videos,
        holdImages: result.holdImages,
      }),
    );
  }
  return result;
}
