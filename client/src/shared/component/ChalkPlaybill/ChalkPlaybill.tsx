import { FC } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { ROUTES } from "../../model/routes";
import type { SiteEvent } from "../../model/siteContent";

type ChalkPlaybillProps = {
  items: SiteEvent[];
  loading: boolean;
  className?: string;
};

export const ChalkPlaybill: FC<ChalkPlaybillProps> = ({ items, loading, className }) => {
  const isEmpty = items.length === 0;

  return (
    <section className={cn("chalk-playbill", className)} aria-label="Афиша спектаклей">
      {loading ? (
        <p className="chalk-playbill__status" role="status">
          Загрузка афиши…
        </p>
      ) : isEmpty ? (
        <p className="chalk-playbill__status" role="status">
          Не удалось загрузить афишу. Проверьте соединение и обновите страницу.
        </p>
      ) : (
        <>
          <div className="chalk-playbill__list" role="list">
            {items.map((event) => (
              <PlaybillRow key={event.slug} event={event} />
            ))}
          </div>
          <p className="chalk-playbill__hint">билеты — на странице спектакля</p>
        </>
      )}
    </section>
  );
};

function PlaybillRow({ event }: { event: SiteEvent }) {
  const title = event.name?.trim() || "Спектакль";
  const dateLabel = event.soon
    ? "скоро"
    : event.date?.trim() || event.type?.trim() || "дата уточняется";
  const ageLabel = event.old?.trim();
  const isSoon = event.soon;
  const rowClassName = cn("chalk-playbill__row", isSoon && "chalk-playbill__row--soon");

  const content = (
    <>
      <div className="chalk-playbill__main">
        {ageLabel && <span className="chalk-playbill__badge">{ageLabel}</span>}
        <span className="chalk-playbill__title">{title}</span>
      </div>
      <span className="chalk-playbill__date">{dateLabel}</span>
    </>
  );

  if (isSoon) {
    return (
      <div className={rowClassName} role="listitem" aria-label={`${title}, скоро`}>
        {content}
      </div>
    );
  }

  return (
    <Link
      to={`/${ROUTES.EVENTS}/${encodeURIComponent(event.slug)}`}
      className={rowClassName}
      role="listitem"
      aria-label={`${title}, ${dateLabel}`}
    >
      {content}
    </Link>
  );
}
