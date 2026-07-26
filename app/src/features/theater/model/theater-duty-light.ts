export const THEATER_DUTY_LIGHT_EVENT = "orchestra:theater-duty-light";

export type TheaterDutyLightRequest = {
  enabled: boolean;
};

export function requestTheaterDutyLight(enabled: boolean) {
  window.dispatchEvent(
    new CustomEvent<TheaterDutyLightRequest>(THEATER_DUTY_LIGHT_EVENT, {
      detail: { enabled },
    }),
  );
}
