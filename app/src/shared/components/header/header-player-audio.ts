export function audioSrcMatches(audio: HTMLAudioElement, src: string): boolean {
  if (!src) return false;
  const attr = audio.getAttribute("src") ?? "";
  if (attr === src) return true;
  try {
    return audio.src === new URL(src, window.location.href).href;
  } catch {
    return audio.src === src;
  }
}

export async function playAudioWithSrc(audio: HTMLAudioElement, src: string): Promise<void> {
  if (!audioSrcMatches(audio, src)) {
    audio.src = src;
    audio.load();
  }
  await audio.play();
}

export function clampRangeFillPercent(min: number, max: number, value: number): number {
  if (max <= min) return 0;
  const pct = ((value - min) / (max - min)) * 100;
  return Math.min(100, Math.max(0, pct));
}

export function bindRangeFill(el: HTMLInputElement | null, fillPercent: number): void {
  if (!el) return;
  el.style.setProperty("--range-fill", `${fillPercent}%`);
}
