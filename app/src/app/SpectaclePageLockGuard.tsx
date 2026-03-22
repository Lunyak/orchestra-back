import { useEffect, useSyncExternalStore } from "react";
import { useBlocker } from "react-router-dom";
import { isOrchestraWebAppSubpath } from "../shared/settings/orchestraWebHost";
import { getSpectaclePageLockEnabled } from "../shared/settings/spectaclePageLock";

function subscribeLock(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("orchestra-spectacle-lock-changed", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("orchestra-spectacle-lock-changed", onStoreChange);
  };
}

function getLockSnapshot(): boolean {
  return getSpectaclePageLockEnabled();
}

function getServerLockSnapshot(): boolean {
  return false;
}

/**
 * Режим «не уходить с /orkestr»: блок SPA-навигации (useBlocker) и предупреждение при
 * перезагрузке/закрытии вкладки (beforeunload). Полностью запретить reload скриптом нельзя —
 * браузер покажет свой диалог.
 */
export function SpectaclePageLockGuard() {
  const lock = useSyncExternalStore(subscribeLock, getLockSnapshot, getServerLockSnapshot);
  const active = lock && isOrchestraWebAppSubpath();

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      active &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search ||
        currentLocation.hash !== nextLocation.hash),
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    const ok = window.confirm(
      "Включён режим «не покидать страницу оркестра». Выйти с этой страницы?",
    );
    if (ok) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);

  return null;
}
