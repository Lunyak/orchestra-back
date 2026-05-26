export type TheaterCameraState = {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
};

export const DEFAULT_THEATER_CAMERA: TheaterCameraState = {
  position: [0, 6, 12],
  target: [0, 0, 0],
  fov: 45,
};

export function theaterCameraStorageKey(projectName: string) {
  return `orchestra-theater-camera:${projectName || "default"}`;
}

function isFiniteTriple(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function readTheaterCamera(projectName: string): TheaterCameraState | null {
  try {
    const raw = localStorage.getItem(theaterCameraStorageKey(projectName));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TheaterCameraState>;
    if (!isFiniteTriple(parsed.position) || !isFiniteTriple(parsed.target)) return null;
    const fov = typeof parsed.fov === "number" && Number.isFinite(parsed.fov) ? parsed.fov : 45;
    return { position: parsed.position, target: parsed.target, fov };
  } catch {
    return null;
  }
}

export function writeTheaterCamera(projectName: string, state: TheaterCameraState) {
  try {
    localStorage.setItem(theaterCameraStorageKey(projectName), JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}
