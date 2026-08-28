import { Link } from "react-router-dom";

export type DirectorSessionSlotPageHeadProps = {
  sessionBackHref: string;
  headerTimeLabel: string;
  slotTimeLabel: string;
};

export function DirectorSessionSlotPageHead({
  sessionBackHref,
  headerTimeLabel,
  slotTimeLabel,
}: DirectorSessionSlotPageHeadProps) {
  return (
    <div className="director-session-slot-page__header">
      <Link
        to={sessionBackHref}
        className="director-session-slot-page__back-link"
      >
        ← К сессии
      </Link>
      <div className="director-session-slot-page__title">Слот</div>
      <div className="director-session-slot-page__meta">{headerTimeLabel}</div>
      <div className="director-session-slot-page__meta">{slotTimeLabel}</div>
    </div>
  );
}
