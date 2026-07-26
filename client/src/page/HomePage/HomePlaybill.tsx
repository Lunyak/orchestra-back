import { FC, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../shared/lib/cn";
import { ROUTES } from "../../shared/model/routes";
import type { SiteEvent } from "../../shared/model/siteContent";
import { fetchSiteEvents, readSiteEventsCache } from "../../shared/model/siteContent";

type HomePlaybillProps = {
  className?: string;
};

export const HomePlaybill: FC<HomePlaybillProps> = ({ className }) => {
  const [items, setItems] = useState<SiteEvent[]>(() => readSiteEventsCache() ?? []);
  const [fetchSettled, setFetchSettled] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSiteEvents()
      .then((remote) => {
        if (!alive) return;
        if (remote && remote.length) setItems(remote);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setFetchSettled(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const isEmpty = items.length === 0;
  const isLoading = isEmpty && !fetchSettled;

  return (
    <section
      className={cn("home-playbill", className)}
      aria-label="Афиша спектаклей"
    >
      {isLoading ? (
        <p className="home-playbill__status" role="status">
          Загрузка афиши…
        </p>
      ) : isEmpty ? (
        <p className="home-playbill__status" role="status">
          Не удалось загрузить афишу
        </p>
      ) : (
        <div className="home-playbill__list" role="list">
          {items.map((event) => (
            <PlaybillRow key={event.slug} event={event} />
          ))}
        </div>
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
  const className = cn(
    "home-nav__link",
    "home-playbill__row",
    isSoon && "home-playbill__row--soon"
  );

  const content = (
    <>
      <div className="home-nav__link-main">
        {ageLabel && <span className="home-nav__badge">{ageLabel}</span>}
        <span className="home-nav__title">{title}</span>
      </div>
      <span className="home-nav__description home-playbill__date">{dateLabel}</span>
    </>
  );

  if (isSoon) {
    return (
      <div
        className={className}
        role="listitem"
        aria-disabled="true"
        aria-label={`${title}, скоро`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      to={`/${ROUTES.EVENTS}/${encodeURIComponent(event.slug)}`}
      className={className}
      role="listitem"
      aria-label={`${title}, ${dateLabel}`}
    >
      {content}
    </Link>
  );
}
