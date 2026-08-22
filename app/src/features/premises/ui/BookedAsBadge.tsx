import cn from "classnames";
import type { PremiseBookedAsKind } from "../../../sync/api/premises";
import { premiseBookedAsKindLabel } from "../model/premise-utils";
import "./booked-as-badge.css";

export function BookedAsGlyph({ kind }: { kind: PremiseBookedAsKind }) {
  switch (kind) {
    case "theater":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            d="M4 19V7l8-3 8 3v12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9 19v-6h6v6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "troupe":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="8" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="16" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M4.5 18c.8-2.4 2.6-3.6 5.5-3.6S14.7 15.6 15.5 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M12.5 18c.6-1.7 1.8-2.6 3.9-2.6 2.1 0 3.4.9 4.1 2.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "studio":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            d="M5 19V9l7-4 7 4v10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9 19v-5h6v5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M10 8.5h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "external":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            d="M8 12h8M14 8l4 4-4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 5v14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "user":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M6.5 19c1.1-3 3-4.5 5.5-4.5S16.4 16 17.5 19"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export function BookedAsBadge({
  kind,
  title,
  className,
}: {
  kind: PremiseBookedAsKind;
  title: string;
  className?: string;
}) {
  const kindLabel = premiseBookedAsKindLabel(kind);
  const displayTitle = title.trim() || kindLabel;

  return (
    <span
      className={cn("premises-booked-as", className)}
      title={`${kindLabel}: ${displayTitle}`}
    >
      <span className="premises-booked-as__icon" aria-hidden>
        <BookedAsGlyph kind={kind} />
      </span>
      <span className="premises-booked-as__title">{displayTitle}</span>
    </span>
  );
}
