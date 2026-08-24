import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  appEditorCenterSlot,
  appEditorEndToolsSlot,
  appEditorToolbarActionsSlot,
  appEditorViewMenuSlot,
} from "./app-editor-menubar-slots";

const AppEditorMenubarProviderContext = createContext(true);

export function AppEditorMenubarProvider({ children }: { children: ReactNode }) {
  return (
    <AppEditorMenubarProviderContext.Provider value={true}>
      {children}
    </AppEditorMenubarProviderContext.Provider>
  );
}

function useAppEditorMenubarProvider() {
  const ctx = useContext(AppEditorMenubarProviderContext);
  if (!ctx) {
    throw new Error(
      "AppEditorMenubar hooks must be used within AppEditorMenubarProvider",
    );
  }
}

export function useAppEditorViewMenuRender(
  slotId: string,
  priority: number,
  render: () => ReactNode | null,
) {
  useAppEditorMenubarProvider();
  const renderRef = useRef(render);
  renderRef.current = render;

  useLayoutEffect(() => {
    appEditorViewMenuSlot.register(slotId, priority, () => renderRef.current());
    return () => appEditorViewMenuSlot.unregister(slotId);
  }, [slotId, priority]);

  useLayoutEffect(() => {
    appEditorViewMenuSlot.bump();
  });
}

export function useAppEditorMenubarViewMenu() {
  useSyncExternalStore(
    appEditorViewMenuSlot.subscribe,
    appEditorViewMenuSlot.getRevision,
    appEditorViewMenuSlot.getRevision,
  );
  return appEditorViewMenuSlot.getContent();
}

export function useAppEditorMenubarActionsRender(
  slotId: string,
  priority: number,
  render: () => ReactNode | null,
) {
  useAppEditorMenubarProvider();
  const renderRef = useRef(render);
  renderRef.current = render;

  useLayoutEffect(() => {
    appEditorToolbarActionsSlot.register(slotId, priority, () => renderRef.current());
    return () => appEditorToolbarActionsSlot.unregister(slotId);
  }, [slotId, priority]);

  useLayoutEffect(() => {
    appEditorToolbarActionsSlot.bump();
  });
}

export function useAppEditorMenubarActions(content: ReactNode | null) {
  useAppEditorMenubarActionsRender("legacy-toolbar-actions", 0, () => content);
}

export function useAppEditorMenubarToolbarActions() {
  useSyncExternalStore(
    appEditorToolbarActionsSlot.subscribe,
    appEditorToolbarActionsSlot.getRevision,
    appEditorToolbarActionsSlot.getRevision,
  );
  return appEditorToolbarActionsSlot.getContent("merge");
}

export function useAppEditorMenubarCenterRender(
  slotId: string,
  priority: number,
  render: () => ReactNode | null,
) {
  useAppEditorMenubarProvider();
  const renderRef = useRef(render);
  renderRef.current = render;

  useLayoutEffect(() => {
    appEditorCenterSlot.register(slotId, priority, () => renderRef.current());
    return () => appEditorCenterSlot.unregister(slotId);
  }, [slotId, priority]);

  useLayoutEffect(() => {
    appEditorCenterSlot.bump();
  });
}

export function useAppEditorMenubarCenter() {
  useSyncExternalStore(
    appEditorCenterSlot.subscribe,
    appEditorCenterSlot.getRevision,
    appEditorCenterSlot.getRevision,
  );
  return appEditorCenterSlot.getContent();
}

export function useAppEditorMenubarEndToolsRender(
  slotId: string,
  priority: number,
  render: () => ReactNode | null,
) {
  useAppEditorMenubarProvider();
  const renderRef = useRef(render);
  renderRef.current = render;

  useLayoutEffect(() => {
    appEditorEndToolsSlot.register(slotId, priority, () => renderRef.current());
    return () => appEditorEndToolsSlot.unregister(slotId);
  }, [slotId, priority]);

  useLayoutEffect(() => {
    appEditorEndToolsSlot.bump();
  });
}

export function useAppEditorMenubarEndTools() {
  useSyncExternalStore(
    appEditorEndToolsSlot.subscribe,
    appEditorEndToolsSlot.getRevision,
    appEditorEndToolsSlot.getRevision,
  );
  return appEditorEndToolsSlot.getContent("merge");
}
