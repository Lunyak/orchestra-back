import cn from "classnames";
import { useCallback, useState, type ReactNode } from "react";

function readSectionOpen(storageKey: string, defaultOpen: boolean) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    // ignore
  }
  return defaultOpen;
}

export type TheaterCollapsibleSectionProps = {
  /** Уникальный id для запоминания свёрнуто/развёрнуто */
  sectionId: string;
  title: string;
  /** Одна строка, видна когда секция свёрнута */
  summary?: string;
  defaultOpen?: boolean;
  /** Без шапки и тоггла — контент всегда открыт */
  static?: boolean;
  badge?: string;
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function TheaterCollapsibleSection({
  sectionId,
  title,
  summary,
  defaultOpen = false,
  static: isStatic = false,
  badge,
  headerActions,
  children,
  className,
}: TheaterCollapsibleSectionProps) {
  const storageKey = `orchestra-theater-section:${sectionId}`;
  const [open, setOpen] = useState(() =>
    isStatic ? true : readSectionOpen(storageKey, defaultOpen),
  );

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, [storageKey]);

  if (isStatic) {
    return (
      <section
        className={cn(
          "theater-panel-section",
          "theater-panel-section--open",
          "theater-panel-section--static",
          className,
        )}
      >
        <div className="theater-panel-section__body">{children}</div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "theater-panel-section",
        open && "theater-panel-section--open",
        className,
      )}
    >
      <div className="theater-panel-section__header">
        <button
          type="button"
          className="theater-panel-section__toggle"
          onClick={toggle}
          aria-expanded={open}
        >
          <span className="theater-panel-section__chevron" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
          <span className="theater-panel-section__title">{title}</span>
          {badge ? <span className="theater-panel-section__badge">{badge}</span> : null}
        </button>
        {headerActions ? (
          <div className="theater-panel-section__actions">{headerActions}</div>
        ) : null}
      </div>
      {!open && summary ? (
        <p className="theater-panel-section__summary">{summary}</p>
      ) : null}
      {open ? <div className="theater-panel-section__body">{children}</div> : null}
    </section>
  );
}
