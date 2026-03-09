import { FC, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../../shared/model/routes";
import { ImageWithPreloader } from "../../shared/component/ImageWithPreloader/ImageWithPreloader";
import type { SiteEvent } from "../../shared/model/siteContent";
import { fetchSiteEvents } from "../../shared/model/siteContent";
import { siteAsset } from "../../shared/model/siteAssets";
import { GlitchHero } from "../HomePage/GlitchHero";
import "./style.css";

const FALLBACK_ITEMS: SiteEvent[] = [
  {
    slug: "железнова",
    soon: false,
    name: "Железнова",
    subtitle: "",
    old: "",
    anonse: "",
    date: "",
    cardImage: "vassa-afisha.jpg",
    type: "",
  },
  {
    slug: "заклятие",
    soon: false,
    name: "Заклятие",
    subtitle: "",
    old: "",
    type: "",
    anonse: '"',
    date: "",
    cardImage: "afisha.jpg",
  },
  {
    slug: "зойкина-квартирка",
    soon: true,
    name: "Зойкина квартирка",
    subtitle: "Узнать больше",
    old: "18+",
    type: "трагикомедия",
    anonse: "",
    date: "февраль",
    cardImage: "https://i.pinimg.com/736x/6c/de/d0/6cded009506170d47a5865ae6854bcf4.jpg",
  },
  {
    slug: "чехов-дуэль",
    soon: true,
    name: "Чехов Дуэль",
    subtitle: "Узнать больше",
    old: "18+",
    type: "трагикомедия",
    anonse: "",
    date: "март",
    cardImage: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1583&q=80",
  },
];

const EventsPage: FC = () => {
  const [items, setItems] = useState<SiteEvent[]>(FALLBACK_ITEMS);

  useEffect(() => {
    let alive = true;
    fetchSiteEvents()
      .then((remote) => {
        if (!alive) return;
        if (remote && remote.length) setItems(remote);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="events-page">
      <div className="events-page__content">
        <Link to={ROUTES.HOME} className="events-page__back">
          Назад
        </Link>

        <header className="events-page__header">
          <div className="events-page__hero">
            <GlitchHero as="h1" text="Спектакли" />
          </div>
          <p className="events-page__subtitle">Афиша и даты</p>
        </header>

        <div className="events-cards" role="list" aria-label="Афиша спектаклей">
          {items.map((data) => (
            <Card key={data.slug} data={data} />
          ))}
        </div>
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
  const { name, cardImage, old, type, anonse, date, soon, slug } = data;

  const title = name?.trim() || "Спектакль";
  const description =
    (anonse?.trim() || type?.trim() || "Узнать больше") +
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
