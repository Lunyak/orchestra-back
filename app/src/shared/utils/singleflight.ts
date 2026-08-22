/**
 * Shares one in-flight Promise per key so concurrent callers (React Strict Mode
 * remounts, overlapping effects) hit the network once.
 */
export function createSingleflight<TArgs extends unknown[], TResult>() {
  const inFlight = new Map<string, Promise<TResult>>();

  return function singleflight(
    key: string,
    run: (...args: TArgs) => Promise<TResult>,
    ...args: TArgs
  ): Promise<TResult> {
    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = run(...args).finally(() => {
      if (inFlight.get(key) === promise) {
        inFlight.delete(key);
      }
    });
    inFlight.set(key, promise);
    return promise;
  };
}
