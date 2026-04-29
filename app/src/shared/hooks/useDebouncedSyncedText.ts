import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DEBOUNCE_MS = 600;

/**
 * Локальный черновик + отложенный persist. Смена recordId / размонтирование — flush.
 */
export function useDebouncedSyncedText(
  recordId: string | null | undefined,
  serverValue: string | null | undefined,
  persist: (targetId: string, text: string) => void,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): {
  draft: string;
  onChange: (next: string) => void;
  onBlur: () => void;
} {
  const [draft, setDraft] = useState(() => String(serverValue ?? ""));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(String(serverValue ?? ""));
  const persistRef = useRef(persist);
  persistRef.current = persist;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    const next = String(serverValue ?? "");
    setDraft(next);
    draftRef.current = next;
  }, [recordId, serverValue]);

  useEffect(() => {
    const id = recordId;
    return () => {
      clearTimer();
      if (id) persistRef.current(id, draftRef.current);
    };
  }, [recordId]);

  const onChange = useCallback(
    (next: string) => {
      const id = recordId;
      if (!id) return;
      setDraft(next);
      draftRef.current = next;
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        persistRef.current(id, next);
      }, debounceMs);
    },
    [recordId, debounceMs],
  );

  const onBlur = useCallback(() => {
    if (!recordId) return;
    clearTimer();
    persistRef.current(recordId, draftRef.current);
  }, [recordId]);

  return { draft, onChange, onBlur };
}
