export type FadeTimerId = string | number;

/** Volume fade helpers shared by playlist and header sound players. */
export function createAudioFadeController() {
  const timers = new Map<FadeTimerId, number>();

  function clear(timerId: FadeTimerId) {
    const timer = timers.get(timerId);
    if (timer != null) {
      window.clearInterval(timer);
      timers.delete(timerId);
    }
  }

  function clearAll() {
    timers.forEach((timer) => window.clearInterval(timer));
    timers.clear();
  }

  function run(
    audio: HTMLAudioElement,
    timerId: FadeTimerId,
    from: number,
    to: number,
    durationMs: number,
    onDone?: () => void,
  ) {
    clear(timerId);
    const safeDuration = Math.max(0, durationMs);
    if (safeDuration === 0) {
      audio.volume = to;
      onDone?.();
      return;
    }
    const start = Date.now();
    audio.volume = from;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const ratio = Math.min(1, elapsed / safeDuration);
      audio.volume = from + (to - from) * ratio;
      if (ratio >= 1) {
        clear(timerId);
        onDone?.();
      }
    }, 30);
    timers.set(timerId, timer);
  }

  return { clear, clearAll, run };
}
