/** Регистрация захвата WebGL viewport 3D-театра (для обложки картины). */

type CaptureFn = () => string | null;

let captureFn: CaptureFn | null = null;

export function registerTheaterViewportCapture(fn: CaptureFn | null): void {
  captureFn = fn;
}

export function captureTheaterViewportDataUrl(): string | null {
  try {
    return captureFn?.() ?? null;
  } catch {
    return null;
  }
}
