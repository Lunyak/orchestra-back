import type { PlaylistTrack } from "../../types/playlist";

export type PlaylistCarryover = {
  audio: HTMLAudioElement;
  track: PlaylistTrack;
  projectName: string;
  sceneName: string;
  progress: number;
  duration: number;
  volume: number;
};

let playlistCarryover: PlaylistCarryover | null = null;

function getCarryoverRegistry() {
  const root = window as typeof window & {
    __orchestraPlaylistCarryovers?: Set<HTMLAudioElement>;
  };
  if (!root.__orchestraPlaylistCarryovers) {
    root.__orchestraPlaylistCarryovers = new Set<HTMLAudioElement>();
  }
  return root.__orchestraPlaylistCarryovers;
}

function stopCarryoverAudio(audio: HTMLAudioElement) {
  try {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  } catch {
    // ignore
  }
}

export function clearPlaylistCarryover() {
  const registry = getCarryoverRegistry();
  if (playlistCarryover) {
    stopCarryoverAudio(playlistCarryover.audio);
    registry.delete(playlistCarryover.audio);
    playlistCarryover = null;
  }
  registry.forEach((audio) => {
    stopCarryoverAudio(audio);
    registry.delete(audio);
  });
}

export function registerPlaylistCarryover(audio: HTMLAudioElement) {
  getCarryoverRegistry().add(audio);
}

export function disposePlaylistCarryover(audio: HTMLAudioElement) {
  getCarryoverRegistry().delete(audio);
  stopCarryoverAudio(audio);
}

export function readPlaylistCarryover() {
  return playlistCarryover;
}

export function writePlaylistCarryover(next: PlaylistCarryover | null) {
  playlistCarryover = next;
}
