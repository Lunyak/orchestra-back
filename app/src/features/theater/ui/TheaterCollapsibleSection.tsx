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
  badge?: string;
  children: ReactNode;
  className?: string;
};

export function TheaterCollapsibleSection({
  sectionId,
  title,
  summary,
  defaultOpen = false,
  badge,
  children,
  className,
}: TheaterCollapsibleSectionProps) {
  const storageKey = `orchestra-theater-section:${sectionId}`;
  const [open, setOpen] = useState(() => readSectionOpen(storageKey, defaultOpen));

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

  return (
    <section
      className={cn(
        "theater-panel-section",
        open && "theater-panel-section--open",
        className,
      )}
    >
      <button
        type="button"
        className="theater-panel-section__head"
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="theater-panel-section__chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <span className="theater-panel-section__title">{title}</span>
        {badge ? <span className="theater-panel-section__badge">{badge}</span> : null}
      </button>
      {!open && summary ? (
        <p className="theater-panel-section__summary">{summary}</p>
      ) : null}
      {open ? <div className="theater-panel-section__body">{children}</div> : null}
    </section>
  );
}
