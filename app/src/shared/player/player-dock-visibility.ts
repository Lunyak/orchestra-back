export {
  PLAYER_DOCK_VISIBILITY_EVENT,
  readPlayerDockHidden,
  setPlayerDockHidden,
  togglePlayerDockHidden,
} from "./player-prefs";

/** @deprecated use {@link PLAYER_PREFS_STORAGE_KEY} from ./player-prefs */
export const PLAYER_DOCK_HIDDEN_STORAGE_KEY = "orchestra:player-dock-hidden";
