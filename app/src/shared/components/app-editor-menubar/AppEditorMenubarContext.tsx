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

const EMPTY_SLOT_DEPS: readonly unknown[] = [];

function useMenubarSlotRender(
  slot: typeof appEditorViewMenuSlot,
  slotId: string,
  priority: number,
  render: () => ReactNode | null,
  deps: readonly unknown[] = EMPTY_SLOT_DEPS,
) {
  useAppEditorMenubarProvider();
  const renderRef = useRef(render);
  renderRef.current = render;

  useLayoutEffect(() => {
    slot.register(slotId, priority, () => renderRef.current());
    return () => slot.unregister(slotId);
  }, [slot, slotId, priority]);

  useLayoutEffect(() => {
    slot.bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller lists live-update inputs
  }, deps);
}

export function useAppEditorViewMenuRender(
  slotId: string,
  priority: number,
  render: () => ReactNode | null,
  deps: readonly unknown[] = EMPTY_SLOT_DEPS,
) {
  useMenubarSlotRender(appEditorViewMenuSlot, slotId, priority, render, deps);
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
  deps: readonly unknown[] = EMPTY_SLOT_DEPS,
) {
  useMenubarSlotRender(appEditorToolbarActionsSlot, slotId, priority, render, deps);
}

export function useAppEditorMenubarActions(content: ReactNode | null) {
  useAppEditorMenubarActionsRender("legacy-toolbar-actions", 0, () => content, [content]);
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
  deps: readonly unknown[] = EMPTY_SLOT_DEPS,
) {
  useMenubarSlotRender(appEditorCenterSlot, slotId, priority, render, deps);
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
  deps: readonly unknown[] = EMPTY_SLOT_DEPS,
) {
  useMenubarSlotRender(appEditorEndToolsSlot, slotId, priority, render, deps);
}

export function useAppEditorMenubarEndTools() {
  useSyncExternalStore(
    appEditorEndToolsSlot.subscribe,
    appEditorEndToolsSlot.getRevision,
    appEditorEndToolsSlot.getRevision,
  );
  return appEditorEndToolsSlot.getContent("merge");
}
