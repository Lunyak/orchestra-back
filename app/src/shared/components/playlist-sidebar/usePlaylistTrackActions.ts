import { useCallback, useEffect, useRef, useState } from "react";
import {
  addScenePlaylistTracksFromPathsDesktop,
  deleteScenePlaylistTrackDesktop,
  persistScenePlaylistDesktop,
  pickScenePlaylistTracksDesktop,
  playbookActions,
  uploadScenePlaylistWeb,
} from "../../../features/playbook/model/playbook-slice";
import { getDesktopApi } from "../../platform/desktop-api";
import { useAppDispatch } from "../../store/hooks";
import type { PlaylistTrack } from "../../types/playlist";

export const PLAYLIST_REORDER_MIME = "text/x-orchestra-playlist-reorder";

type UsePlaylistTrackActionsArgs = {
  projectName: string;
  sceneName: string;
  playlist: PlaylistTrack[];
  playlistUploading: boolean;
  isEditMode: boolean;
  onShowMessage: (message: string) => void;
  onTrackDeleted: (track: PlaylistTrack) => void;
};

export function usePlaylistTrackActions({
  projectName,
  sceneName,
  playlist,
  playlistUploading,
  isEditMode,
  onShowMessage,
  onTrackDeleted,
}: UsePlaylistTrackActionsArgs) {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverTrackId, setDragOverTrackId] = useState<number | null>(null);

  useEffect(() => {
    if (!isEditMode) {
      setEditingId(null);
      setEditingTitle("");
    }
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode) {
      setDragOverTrackId(null);
      return;
    }
    const clear = () => setDragOverTrackId(null);
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    };
  }, [isEditMode]);

  const persistPlaylistIfDesktop = useCallback(async () => {
    if (!getDesktopApi()) return;
    try {
      await dispatch(persistScenePlaylistDesktop({ projectSlug: projectName, sceneName })).unwrap();
    } catch (err) {
      console.error("Failed to save playlist:", err);
      onShowMessage("Не удалось сохранить плейлист. Проверьте консоль.");
    }
  }, [dispatch, onShowMessage, projectName, sceneName]);

  const addTracks = async () => {
    if (playlistUploading) return;
    const desktopApi = getDesktopApi();
    try {
      if (desktopApi) {
        await dispatch(
          pickScenePlaylistTracksDesktop({ projectSlug: projectName, sceneName }),
        ).unwrap();
        return;
      }
      fileInputRef.current?.click();
    } catch (err) {
      console.error("Failed to add tracks:", err);
      onShowMessage("Не удалось добавить аудио. Проверьте консоль.");
    }
  };

  const addTracksFromPaths = async (filePaths: string[]) => {
    if (playlistUploading) return;
    const desktopApi = getDesktopApi();
    if (!desktopApi) {
      onShowMessage("Drag-and-drop с путями файлов доступен только в десктоп-версии приложения.");
      return;
    }
    try {
      await dispatch(
        addScenePlaylistTracksFromPathsDesktop({
          projectSlug: projectName,
          sceneName,
          filePaths,
        }),
      ).unwrap();
    } catch (err) {
      console.error("Failed to add audio:", err);
      onShowMessage("Не удалось добавить аудио. Проверьте консоль.");
    }
  };

  const startRename = (track: PlaylistTrack) => {
    setEditingId(track.id);
    setEditingTitle(track.title);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const applyRename = async (track: PlaylistTrack) => {
    const nextTitle = editingTitle.trim();
    if (!nextTitle) return;
    dispatch(playbookActions.updatePlaylistTrack({ id: track.id, changes: { title: nextTitle } }));
    if (getDesktopApi()) {
      await persistPlaylistIfDesktop();
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const updateFade = async (track: PlaylistTrack, nextFade: number) => {
    dispatch(playbookActions.updatePlaylistTrack({ id: track.id, changes: { fadeMs: nextFade } }));
    if (getDesktopApi()) {
      await persistPlaylistIfDesktop();
    }
  };

  const updateLoop = async (track: PlaylistTrack, nextLoop: boolean) => {
    dispatch(playbookActions.updatePlaylistTrack({ id: track.id, changes: { loop: nextLoop } }));
    if (getDesktopApi()) {
      await persistPlaylistIfDesktop();
    }
  };

  const deleteTrack = async (track: PlaylistTrack) => {
    const desktopApi = getDesktopApi();
    try {
      if (desktopApi) {
        await dispatch(
          deleteScenePlaylistTrackDesktop({
            projectSlug: projectName,
            sceneName,
            id: track.id,
            file: track.file,
          }),
        ).unwrap();
      } else {
        dispatch(
          playbookActions.setPlaylist(playlist.filter((t) => Number(t.id) !== Number(track.id))),
        );
      }
    } catch (err) {
      console.error("Failed to delete audio:", err);
      onShowMessage("Не удалось удалить аудио. Проверьте консоль.");
    }
    onTrackDeleted(track);
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const files = Array.from(event.dataTransfer.files || []);
    if (files.length === 0) return;

    const desktopApi = getDesktopApi();
    if (!desktopApi) {
      void dispatch(uploadScenePlaylistWeb({ projectSlug: projectName, files }))
        .unwrap()
        .catch((err) => {
          console.error("Failed to upload playlist tracks (web):", err);
          onShowMessage("Не удалось загрузить аудио. Проверьте авторизацию/консоль.");
        });
      return;
    }
    const filePaths = files
      .map((file) => (file as { path?: string }).path)
      .filter((path): path is string => Boolean(path));
    if (filePaths.length === 0) {
      console.warn("No file paths provided by drag-and-drop.");
      return;
    }
    void addTracksFromPaths(filePaths);
  };

  const handleWebFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (list.length === 0) return;
    void dispatch(uploadScenePlaylistWeb({ projectSlug: projectName, files: list }))
      .unwrap()
      .catch((err) => {
        console.error("Failed to upload playlist tracks (web):", err);
        onShowMessage("Не удалось загрузить аудио. Проверьте авторизацию/консоль.");
      });
  };

  const reorderTrack = (fromIndex: number, toIndex: number) => {
    dispatch(playbookActions.reorderPlaylist({ fromIndex, toIndex }));
    void persistPlaylistIfDesktop();
  };

  const desktopAvailable = Boolean(getDesktopApi());
  const addButtonTitle = desktopAvailable ? "Добавить аудио" : "Добавить аудио (веб)";

  return {
    fileInputRef,
    editingId,
    editingTitle,
    setEditingTitle,
    isDragOver,
    dragOverTrackId,
    setDragOverTrackId,
    addTracks,
    addButtonTitle,
    desktopAvailable,
    startRename,
    cancelRename,
    applyRename,
    updateFade,
    updateLoop,
    deleteTrack,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleWebFileInputChange,
    reorderTrack,
  };
}
