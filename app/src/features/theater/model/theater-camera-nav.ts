export const THEATER_CAMERA_NAV_EVENT = "orchestra:theater-camera-nav";

export type TheaterCameraNavMode = "pan" | "orbit";
export type TheaterCameraNavDirection = "up" | "down" | "left" | "right";

export type TheaterCameraNavRequest = {
  action: "start" | "stop";
  mode?: TheaterCameraNavMode;
  direction?: TheaterCameraNavDirection;
};

export function startTheaterCameraNav(
  mode: TheaterCameraNavMode,
  direction: TheaterCameraNavDirection,
) {
  window.dispatchEvent(
    new CustomEvent<TheaterCameraNavRequest>(THEATER_CAMERA_NAV_EVENT, {
      detail: { action: "start", mode, direction },
    }),
  );
}

export function stopTheaterCameraNav() {
  window.dispatchEvent(
    new CustomEvent<TheaterCameraNavRequest>(THEATER_CAMERA_NAV_EVENT, {
      detail: { action: "stop" },
    }),
  );
}
