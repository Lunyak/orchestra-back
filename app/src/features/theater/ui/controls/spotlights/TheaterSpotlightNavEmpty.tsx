import type { ReactNode } from "react";

export type TheaterSpotlightNavEmptyProps = {
  title: string;
  hint: string;
  actionLabel: string;
  disabled?: boolean;
  onAdd: () => void;
  icon: ReactNode;
};

export function TheaterSpotlightNavEmpty({
  title,
  hint,
  actionLabel,
  disabled,
  onAdd,
  icon,
}: TheaterSpotlightNavEmptyProps) {
  return (
    <div className="theater-spotlight-nav-empty">
      <svg
        className="theater-spotlight-nav-empty__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {icon}
      </svg>
      <p className="theater-spotlight-nav-empty__title">{title}</p>
      <p className="theater-spotlight-nav-empty__hint">{hint}</p>
      <button
        type="button"
        className="theater-sidebar-home__item theater-spotlight-nav-empty__action"
        disabled={disabled}
        onClick={onAdd}
      >
        <span className="theater-spotlight-nav-empty__action-mark" aria-hidden>
          +
        </span>
        <span className="theater-sidebar-home__label">{actionLabel}</span>
      </button>
    </div>
  );
}
