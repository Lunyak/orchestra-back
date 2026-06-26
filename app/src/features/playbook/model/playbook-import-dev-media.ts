import {
  mergeScannedMediaIntoScene,
  pickProjectMediaFolder,
  scanProjectMediaFolder,
  type ProjectMediaScan,
} from "../../../shared/platform/project-media-folder";
import type { BrowserPickedScan } from "../../../shared/platform/browser-picked-media";
import { store } from "../../../shared/store/store";
import type { AppDispatch } from "../../../shared/store/store";
import { playbookActions } from "./playbook-slice";

export async function importPlaybookDevMediaFolder(
  dispatch: AppDispatch,
  projectName: string,
  opts?: {
    force?: boolean;
    scanned?: ProjectMediaScan | BrowserPickedScan;
    pickIfMissing?: boolean;
  },
) {
  if (!projectName) {
    throw new Error("Выберите проект");
  }
  let scan: ProjectMediaScan | undefined =
    opts?.scanned && opts.scanned.ok ? (opts.scanned as ProjectMediaScan) : undefined;
  if (!scan?.ok) {
    const resolved = await scanProjectMediaFolder(projectName);
    scan = resolved.ok ? resolved : undefined;
  }
  if (!scan?.ok && opts?.pickIfMissing !== false) {
    const picked = await pickProjectMediaFolder(projectName);
    if (!picked.ok) {
      throw new Error(picked.error ?? "Выберите папку с медиа для проекта");
    }
    scan = picked;
  }
  if (!scan?.ok) {
    throw new Error(scan?.error ?? "Папка с медиа не выбрана");
  }
  const state = store.getState().playbook;
  const merged = mergeScannedMediaIntoScene(
    state.playbookData?.videos ?? [],
    state.playbookData?.holdImages ?? [],
    state.playbookData?.playlist ?? [],
    scan,
  );
  dispatch(
    playbookActions.setProjectorMediaLibrary({
      videos: merged.videos,
      holdImages: merged.holdImages,
    }),
  );
  dispatch(playbookActions.setPlaylist(merged.playlist));
  const label = scan.mediaRoot ?? scan.folderName ?? "локальная папка";
  const soundCount = scan.sounds?.length ?? 0;
  const soundNote = soundCount > 0 ? `, ${soundCount} mp3 в папке` : "";
  return {
    message: `Подключено: ${merged.videos.length} видео, ${merged.holdImages.length} заставок${soundNote} (${label})`,
    videos: merged.videos,
    holdImages: merged.holdImages,
    folderLabel: label,
  };
}
