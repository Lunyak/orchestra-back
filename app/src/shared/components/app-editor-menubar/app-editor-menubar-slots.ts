import type { ReactNode } from "react";

type SlotListener = () => void;

type SlotRegistration = {
  priority: number;
  render: () => ReactNode | null;
};

class MenubarSlot {
  private registrations = new Map<string, SlotRegistration>();

  private revision = 0;

  private listeners = new Set<SlotListener>();

  subscribe = (listener: SlotListener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getRevision = () => this.revision;

  getContent = (mode: "exclusive" | "merge" = "exclusive"): ReactNode | null => {
    if (mode === "merge") {
      const registrations = [...this.registrations.values()].sort(
        (a, b) => b.priority - a.priority,
      );
      const nodes = registrations
        .map((registration) => registration.render())
        .filter((node) => node != null);
      if (nodes.length === 0) return null;
      if (nodes.length === 1) return nodes[0];
      return nodes;
    }

    let best: SlotRegistration | null = null;
    for (const registration of this.registrations.values()) {
      if (!best || registration.priority >= best.priority) {
        best = registration;
      }
    }
    return best?.render() ?? null;
  };

  register = (id: string, priority: number, render: () => ReactNode | null) => {
    this.registrations.set(id, { priority, render });
    this.bump();
  };

  unregister = (id: string) => {
    if (!this.registrations.delete(id)) return;
    this.bump();
  };

  bump = () => {
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
  };
}

export const appEditorViewMenuSlot = new MenubarSlot();
export const appEditorToolbarActionsSlot = new MenubarSlot();
export const appEditorCenterSlot = new MenubarSlot();
