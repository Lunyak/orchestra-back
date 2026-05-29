import type { ReactNode } from "react";

type MenubarPanelIconProps = {
  active: boolean;
  children: ReactNode;
};

export function MenubarPanelIcon({ active, children }: MenubarPanelIconProps) {
  return (
    <span
      className={[
        "app-editor-menubar__panel-icon",
        active ? "" : "app-editor-menubar__panel-icon--muted",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
