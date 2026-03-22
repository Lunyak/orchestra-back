import { FC, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../../shared/model/routes";
import { ImageWithPreloader } from "../../shared/component/ImageWithPreloader/ImageWithPreloader";
import Preloader from "../../shared/component/Preloader/Preloader";
import { Seo } from "../../shared/component/Seo/Seo";
import type { SiteEvent } from "../../shared/model/siteContent";
import { fetchSiteEvents, readSiteEventsCache } from "../../shared/model/siteContent";
import { siteAsset } from "../../shared/model/siteAssets";
import { GlitchHero } from "../HomePage/GlitchHero";
import "./style.css";

const EventsPage: FC = () => {
  const [items, setItems] = useState<SiteEvent[]>(() => readSiteEventsCache() ?? []);
  const [eventsFetchSettled, setEventsFetchSettled] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSiteEvents()
      .then((remote) => {
        if (!alive) return;
        if (remote && remote.length) setItems(remote);
      })
      .catch(() => {
        // fetchSiteEvents already falls back to session cache; ignore
      })
      .finally(() => {
        if (alive) setEventsFetchSettled(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="events-page">
      <div className="events-page__content">
        <Seo
          title="Спектакли и афиша — Дофамин"
          description="Афиша театра «Дофамин»: спектакли, описание и ссылки на покупку билетов онлайн."
          canonicalPath="/события"
          jsonLd={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Афиша театра «Дофамин»",
            itemListElement: items
              .filter((e) => !e.soon)
              .map((e, idx) => ({
                "@type": "ListItem",
                position: idx + 1,
                name: e.name,
                url:
                  typeof window !== "undefined"
                    ? `${window.location.origin}/события/${encodeURIComponent(e.slug)}`
                    : undefined,
              })),
          }}
        />
        <Link to={ROUTES.HOME} className="events-page__back">
          Назад
        </Link>

        <header className="events-page__header">
          <div className="events-page__hero">
            <GlitchHero as="h1" text="Спектакли" />
          </div>
          <p className="events-page__subtitle">Афиша и даты</p>
        </header>

        {items.length === 0 && !eventsFetchSettled ? (
          <div className="events-page__list-loading">
            <Preloader label="Загрузка афиши…" />
          </div>
        ) : items.length === 0 ? (
          <p className="events-page__list-empty" role="status">
            Не удалось загрузить афишу. Проверьте соединение и обновите страницу.
          </p>
        ) : (
          <div className="events-cards" role="list" aria-label="Афиша спектаклей">
            {items.map((data) => (
              <Card key={data.slug} data={data} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const Component = EventsPage;

interface ICardProps {
  data: ICard;
}

type ICard = {
  name: string;
  cardImage: string;
  subtitle?: string;
  old?: string;
  type?: string;
  anonse?: string;
  date?: string;
  soon: boolean;
  slug: string;
};

const Card: FC<ICardProps> = ({ data }) => {
  const { name, cardImage, old, type, date, soon, slug } = data;

  const title = name?.trim() || "Спектакль";
  // Do NOT show long "anonse" on the card; keep it for the Event page only.
  const description =
    (type?.trim() || "") +
    (date?.trim() ? ` · ${date.trim()}` : "");

  const ariaLabelBase = `${title}${old?.trim() ? `, ${old.trim()}` : ""}`;

  if (soon) {
    return (
      <div className="events-card" role="listitem">
        <div
          className="events-card__link events-card__link--disabled"
          role="link"
          aria-disabled="true"
          aria-label={`${ariaLabelBase}, скоро`}
        >
          <ImageWithPreloader
            className="events-card__imgWrap"
            imgClassName="events-card__img"
            src={siteAsset(cardImage)}
            alt={title}
            loading="lazy"
            decoding="async"
            spinnerSize={56}
          />

          <div className="events-card__badge">скоро</div>
          {old?.trim() && <div className="events-card__age">{old.trim()}</div>}

          <div className="events-card__title">{title}</div>
          <p className="events-card__desc">{description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="events-card" role="listitem">
      <Link
        to={encodeURIComponent(slug)}
        className="events-card__link"
        aria-label={ariaLabelBase}
      >
        <ImageWithPreloader
          className="events-card__imgWrap"
          imgClassName="events-card__img"
          src={siteAsset(cardImage)}
          alt={title}
          loading="lazy"
          decoding="async"
          spinnerSize={56}
        />

        {old?.trim() && <div className="events-card__age">{old.trim()}</div>}

        <p className="events-card__desc">{description}</p>
      </Link>
    </div>
  );
};
