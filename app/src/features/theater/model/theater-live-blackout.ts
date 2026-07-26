export const THEATER_LIVE_BLACKOUT_EVENT = "orchestra:theater-live-blackout";

export type TheaterLiveBlackoutRequest = {
  enabled: boolean;
};

let liveBlackoutEnabled = false;

export function getTheaterLiveBlackoutEnabled(): boolean {
  return liveBlackoutEnabled;
}

export function requestTheaterLiveBlackout(enabled: boolean) {
  liveBlackoutEnabled = enabled;
  window.dispatchEvent(
    new CustomEvent<TheaterLiveBlackoutRequest>(THEATER_LIVE_BLACKOUT_EVENT, {
      detail: { enabled },
    }),
  );
}
