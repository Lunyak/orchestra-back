import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  getPlaylistActiveTrackId,
  invokePlaylistPlay,
  registerPlaylistNextHandler,
  registerPlaylistPrevHandler,
  registerPlaylistSeekHandler,
  subscribePlaylistActiveTrack,
  updatePlaylistProgress,
} from "../../../features/playbook/model/playbook-playback-bridge";
import type { PlaylistTrack } from "../../types/playlist";
import {
  getPlaylistTrackIndex,
  pickAudioByKey,
  type PlaylistAudioKey,
} from "./playlist-playback-helpers";

type UsePlaylistQueueNavArgs = {
  playlist: PlaylistTrack[];
  currentTrack: PlaylistTrack | null;
  activeAudioKey: PlaylistAudioKey;
  showPlayer: boolean;
  audioRefA: RefObject<HTMLAudioElement | null>;
  audioRefB: RefObject<HTMLAudioElement | null>;
  durationRef: MutableRefObject<number>;
  setProgress: (value: number) => void;
  playTrack: (track: PlaylistTrack) => void;
};

export function usePlaylistQueueNav({
  playlist,
  currentTrack,
  activeAudioKey,
  showPlayer,
  audioRefA,
  audioRefB,
  durationRef,
  setProgress,
  playTrack,
}: UsePlaylistQueueNavArgs) {
  const seekPlayer = (nextValue: number) => {
    const audio = pickAudioByKey(activeAudioKey, audioRefA.current, audioRefB.current);
    if (!audio || !Number.isFinite(nextValue)) return;
    audio.currentTime = nextValue;
    setProgress(nextValue);
    updatePlaylistProgress(nextValue, durationRef.current);
  };

  const seekPlayerRef = useRef(seekPlayer);
  seekPlayerRef.current = seekPlayer;

  useEffect(() => {
    registerPlaylistSeekHandler((value) => seekPlayerRef.current(value));
    return () => registerPlaylistSeekHandler(undefined);
  }, []);

  const sharedActiveTrackId = useSyncExternalStore(
    subscribePlaylistActiveTrack,
    getPlaylistActiveTrackId,
    getPlaylistActiveTrackId,
  );

  const highlightedTrack = useMemo(() => {
    if (sharedActiveTrackId != null) {
      const fromShared = playlist.find(
        (track) => Number(track.id) === Number(sharedActiveTrackId),
      );
      if (fromShared) return fromShared;
    }
    return currentTrack;
  }, [sharedActiveTrackId, playlist, currentTrack]);

  const currentTrackIndex = getPlaylistTrackIndex(playlist, highlightedTrack);
  const canGoPrevTrack = currentTrackIndex > 0;
  const canGoNextTrack =
    currentTrackIndex >= 0 && currentTrackIndex < playlist.length - 1;

  const playTrackAt = (index: number) => {
    const track = playlist[index];
    if (!track) return;
    if (showPlayer) {
      void playTrack(track);
      return;
    }
    invokePlaylistPlay(track.id);
  };

  const playPreviousTrack = () => {
    if (!canGoPrevTrack) return;
    playTrackAt(currentTrackIndex - 1);
  };

  const playNextTrack = () => {
    if (!canGoNextTrack) return;
    playTrackAt(currentTrackIndex + 1);
  };

  const playPreviousTrackRef = useRef(playPreviousTrack);
  playPreviousTrackRef.current = playPreviousTrack;
  const playNextTrackRef = useRef(playNextTrack);
  playNextTrackRef.current = playNextTrack;

  useEffect(() => {
    registerPlaylistPrevHandler(() => playPreviousTrackRef.current());
    registerPlaylistNextHandler(() => playNextTrackRef.current());
    return () => {
      registerPlaylistPrevHandler(undefined);
      registerPlaylistNextHandler(undefined);
    };
  }, []);

  return {
    seekPlayer,
    highlightedTrack,
    canGoPrevTrack,
    canGoNextTrack,
    playPreviousTrack,
    playNextTrack,
  };
}
