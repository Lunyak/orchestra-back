import type { PlaylistPlayOptions } from "../../../features/playbook/model/playbook-playback-bridge";
import type { PlaylistTrack } from "../../types/playlist";

export type UsePlaylistPlaybackArgs = {
  projectName: string;
  sceneName: string;
  playlist: PlaylistTrack[];
  accessToken: string | null;
  crossfadeEnabled: boolean;
  volume: number;
  setVolume: (value: number) => void;
  onRegisterPlayHandler?: (handler: (trackId: number, options?: PlaylistPlayOptions) => void) => void;
  showPlayer: boolean;
};
