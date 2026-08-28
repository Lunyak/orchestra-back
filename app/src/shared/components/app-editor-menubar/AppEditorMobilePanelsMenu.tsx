import cn from "classnames";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { PROJECT_ONBOARDING_PANELS_ATTR } from "../../../features/project/model/project-onboarding";

type AppEditorMobilePanelsMenuProps = {
  children: ReactNode;
};

export function AppEditorMobilePanelsMenu({ children }: AppEditorMobilePanelsMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const handleActionsClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) {
      closeMenu();
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "theater-editor-menubar__menu",
        "app-editor-mobile-panels",
        isOpen && "theater-editor-menubar__menu--open",
      )}
    >
      <button
        type="button"
        className="theater-editor-menubar__menu-title app-editor-mobile-panels__trigger"
        aria-label={isOpen ? "Скрыть панели" : "Показать панели"}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="Панели"
        data-onboarding={PROJECT_ONBOARDING_PANELS_ATTR}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="app-editor-menubar__panel-icon" aria-hidden>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </span>
      </button>
      <div
        className="theater-editor-menubar__options app-editor-mobile-panels__options"
        role="menu"
      >
        <div
          className="app-editor-mobile-panels__actions"
          role="group"
          aria-label="Панели и инструменты"
          onClick={handleActionsClick}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
