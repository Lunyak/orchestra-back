import type { HTMLAttributes, ReactNode } from "react";
import "./rehearsals-card.css";

type Props = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  /** Section heading (maps to `.rehearsals-card-title`). */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Stretch to full width of the grid/flex parent (drops `max-width: 500px`). */
  fluid?: boolean;
};

export function RehearsalsCard({
  title,
  subtitle,
  className,
  fluid,
  children,
  ...rest
}: Props) {
  const cls = ["rehearsals-card", fluid ? "rehearsals-card--fluid" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} {...rest}>
      {title != null && title !== false ? <div className="rehearsals-card-title">{title}</div> : null}
      {subtitle != null ? <div className="rehearsals-card-sub">{subtitle}</div> : null}
      {children}
    </div>
  );
}
