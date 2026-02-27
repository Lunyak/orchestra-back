import React from "react";

export interface PlatformContextValue {
  /** Выгрузка всех локальных данных на сервер (только desktop). */
  onPushAllLocal?: () => Promise<void>;
  /** Ручная "подтяжка отличий" с сервера в локальные файлы (только desktop). */
  onResyncProject?: (
    projectSlug: string,
  ) => Promise<{ updatedScenes: number; totalScenes: number }>;
}

const PlatformContext = React.createContext<PlatformContextValue>({});

export function PlatformProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: PlatformContextValue;
}) {
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): PlatformContextValue {
  return React.useContext(PlatformContext);
}

