import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PageBootState = {
  blocking: boolean;
  label: string;
  setBlocking: (blocking: boolean, label?: string) => void;
};

const PageBootContext = createContext<PageBootState | null>(null);

const DEFAULT_LABEL = "Загрузка…";

export function PageBootProvider({ children }: { children: ReactNode }) {
  const [blocking, setBlockingState] = useState(false);
  const [label, setLabel] = useState(DEFAULT_LABEL);

  const setBlocking = useCallback((next: boolean, nextLabel?: string) => {
    setBlockingState(next);
    if (next) {
      setLabel(nextLabel?.trim() || DEFAULT_LABEL);
      return;
    }
    setLabel(DEFAULT_LABEL);
  }, []);

  const value = useMemo(
    () => ({ blocking, label, setBlocking }),
    [blocking, label, setBlocking],
  );

  return (
    <PageBootContext.Provider value={value}>{children}</PageBootContext.Provider>
  );
}

function usePageBootContext() {
  const ctx = useContext(PageBootContext);
  if (!ctx) {
    throw new Error("Page boot hooks require PageBootProvider");
  }
  return ctx;
}

export function usePageBoot() {
  return usePageBootContext();
}

/** While `active`, hides app chrome (menubar) and shows the shared PageLoader. */
export function usePageBootBlock(active: boolean, label?: string) {
  const { setBlocking } = usePageBootContext();

  useLayoutEffect(() => {
    if (!active) {
      setBlocking(false);
      return;
    }
    setBlocking(true, label);
    return () => setBlocking(false);
  }, [active, label, setBlocking]);
}

/**
 * Full-page route boot: hides menubar and lets AppShell show PageLoader.
 * Use instead of rendering `<PageLoader />` from a page.
 */
export function PageBootLoader({ label = DEFAULT_LABEL }: { label?: string }) {
  usePageBootBlock(true, label);
  return null;
}
