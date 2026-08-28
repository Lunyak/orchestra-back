import { Link } from "react-router-dom";

export type DirectorSessionPageHeadProps = {
  sessionsListHref: string;
  isTheaterContext: boolean;
  title: string;
};

export function DirectorSessionPageHead({
  sessionsListHref,
  isTheaterContext,
  title,
}: DirectorSessionPageHeadProps) {
  const backLabel = isTheaterContext ? "← Репетиции" : "← К списку сессий";

  return (
    <div className="director-session-page__head">
      <div className="director-session-page__title-row">
        <Link to={sessionsListHref} className="director-session-page__back">
          {backLabel}
        </Link>
        <h1 className="director-session-page__title">{title}</h1>
      </div>
    </div>
  );
}
