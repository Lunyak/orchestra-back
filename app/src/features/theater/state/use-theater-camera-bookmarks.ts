import { useCallback, useState } from "react";
import {
  addTheaterCameraBookmark,
  applyTheaterCameraBookmark,
  readTheaterCameraBookmarks,
  removeTheaterCameraBookmark,
  requestTheaterCameraCapture,
  type TheaterCameraBookmark,
} from "../model/theater-camera-bookmarks";

export type UseTheaterCameraBookmarksArgs = {
  projectName: string;
  setDecorActionMessage: (message: string | null) => void;
};

export function useTheaterCameraBookmarks({
  projectName,
  setDecorActionMessage,
}: UseTheaterCameraBookmarksArgs) {
  const [cameraBookmarks, setCameraBookmarks] = useState<TheaterCameraBookmark[]>(() =>
    readTheaterCameraBookmarks(projectName),
  );

  const saveCameraBookmark = useCallback(
    async (label: string) => {
      const state = await requestTheaterCameraCapture();
      if (!state) {
        setDecorActionMessage("Не удалось сохранить вид камеры");
        return;
      }
      const next = addTheaterCameraBookmark(projectName, label, state);
      setCameraBookmarks(next);
      setDecorActionMessage("Закладка камеры сохранена");
    },
    [projectName, setDecorActionMessage],
  );

  const applyCameraBookmark = useCallback((bookmark: TheaterCameraBookmark) => {
    applyTheaterCameraBookmark(bookmark);
  }, []);

  const deleteCameraBookmark = useCallback(
    (id: string) => {
      const next = removeTheaterCameraBookmark(projectName, id);
      setCameraBookmarks(next);
    },
    [projectName],
  );

  return {
    cameraBookmarks,
    saveCameraBookmark,
    applyCameraBookmark,
    deleteCameraBookmark,
  };
}
