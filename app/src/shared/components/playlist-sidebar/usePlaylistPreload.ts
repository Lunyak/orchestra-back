import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildPlaylistCacheKey,
  fetchAndCachePlaylistTrack,
  isWebMediaCacheEnabled,
  isWebMediaCached,
  resolveWebPlaylistPlaybackUrl,
} from "../../media/web-media-cache";
import type { PlaylistTrack } from "../../types/playlist";
import {
  type PlaylistPreloadStatus,
  waitForAudioReady,
} from "./playlist-playback-helpers";

type UsePlaylistPreloadArgs = {
  projectName: string;
  playlist: PlaylistTrack[];
  accessToken: string | null;
  resolveTrackPlaybackSrc: (track: PlaylistTrack) => Promise<string>;
};

export function usePlaylistPreload({
  projectName,
  playlist,
  accessToken,
  resolveTrackPlaybackSrc,
}: UsePlaylistPreloadArgs) {
  const [preloadRunning, setPreloadRunning] = useState(false);
  const [preloadDone, setPreloadDone] = useState(0);
  const [preloadStatusById, setPreloadStatusById] = useState<
    Record<number, PlaylistPreloadStatus>
  >({});
  const preloadRunIdRef = useRef(0);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isWebMediaCacheEnabled() || playlist.length === 0) return;
    let cancelled = false;
    void (async () => {
      const next: Record<number, PlaylistPreloadStatus> = {};
      for (const track of playlist) {
        const key = buildPlaylistCacheKey(projectName, track);
        next[track.id] = (await isWebMediaCached(key)) ? "ready" : "idle";
      }
      if (cancelled) return;
      setPreloadStatusById((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [playlist, projectName]);

  const preloadOne = useCallback(
    async (track: PlaylistTrack, runId: number) => {
      if (isWebMediaCacheEnabled()) {
        await fetchAndCachePlaylistTrack(projectName, track, accessToken);
        if (runId !== preloadRunIdRef.current) {
          throw new Error("cancelled");
        }
        const src = await resolveWebPlaylistPlaybackUrl(projectName, track, accessToken);
        if (!src) throw new Error("cache miss");
        const audio = preloadAudioRef.current ?? new Audio();
        preloadAudioRef.current = audio;
        audio.preload = "auto";
        audio.muted = true;
        audio.volume = 0;
        if (audio.src !== src) audio.src = src;
        audio.load();
        await waitForAudioReady(audio);
        if (runId !== preloadRunIdRef.current) throw new Error("cancelled");
        return;
      }

      const src = await resolveTrackPlaybackSrc(track);
      const audio = preloadAudioRef.current ?? new Audio();
      preloadAudioRef.current = audio;
      audio.preload = "auto";
      audio.muted = true;
      audio.volume = 0;
      if (audio.src !== src) audio.src = src;
      audio.load();

      await waitForAudioReady(audio, { includeLoadedMetadata: true });

      if (runId !== preloadRunIdRef.current) throw new Error("cancelled");
    },
    [accessToken, projectName, resolveTrackPlaybackSrc],
  );

  const preparePlaylist = useCallback(async () => {
    if (playlist.length === 0) return;
    preloadRunIdRef.current += 1;
    const runId = preloadRunIdRef.current;
    setPreloadRunning(true);
    setPreloadDone(0);
    setPreloadStatusById(() => {
      const next: Record<number, PlaylistPreloadStatus> = {};
      playlist.forEach((t) => (next[t.id] = "idle"));
      return next;
    });

    for (let i = 0; i < playlist.length; i += 1) {
      const t = playlist[i];
      if (runId !== preloadRunIdRef.current) break;
      setPreloadStatusById((prev) => ({ ...prev, [t.id]: "loading" }));
      try {
        await preloadOne(t, runId);
        if (runId !== preloadRunIdRef.current) break;
        setPreloadStatusById((prev) => ({ ...prev, [t.id]: "ready" }));
      } catch {
        if (runId !== preloadRunIdRef.current) break;
        setPreloadStatusById((prev) => ({ ...prev, [t.id]: "error" }));
      }
      setPreloadDone((d) => d + 1);
      await new Promise((r) => window.setTimeout(r, 0));
    }

    if (runId === preloadRunIdRef.current) {
      setPreloadRunning(false);
    }
  }, [playlist, preloadOne]);

  const cancelPrepare = useCallback(() => {
    preloadRunIdRef.current += 1;
    setPreloadRunning(false);
  }, []);

  return {
    preloadRunning,
    preloadDone,
    preloadStatusById,
    preparePlaylist,
    cancelPrepare,
  };
}
