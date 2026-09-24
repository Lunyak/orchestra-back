/* eslint-disable no-useless-escape */
import { CSSProperties, FC, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperClass, SwiperSlide } from "swiper/react";
import { ChalkPageShell } from "../../shared/component/ChalkPageShell/ChalkPageShell";
import { ImageWithPreloader } from "../../shared/component/ImageWithPreloader/ImageWithPreloader";
import { Seo } from "../../shared/component/Seo/Seo";
import { ROUTES } from "../../shared/model/routes";
import type { SiteEvent } from "../../shared/model/siteContent";
import { fetchSiteEvents, mergeSiteEventsWithFallback } from "../../shared/model/siteContent";
import { isAbsoluteUrl, siteAsset } from "../../shared/model/siteAssets";
import { hitSiteEventView } from "../../shared/model/siteViews";
import {
  VASSA_ZHELEZNOVA_ANONSE,
  VASSA_ZHELEZNOVA_REVIEWS,
} from "./vassa-zheleznova-content";
import "./style.css";

const FALLBACK_EVENTS: SiteEvent[] = [
  {
    slug: "железнова",
    soon: false,
    name: "Железнова",
    subtitle: "",
    old: "16+",
    type: "драма",
    anonse: VASSA_ZHELEZNOVA_ANONSE,
    date: "",
    cardImage: "vassa-afisha.jpg",
    colorBackground: 0x6b0f1a,
    photos: [
      "/photos/vassa/0.jpg",
      "/photos/vassa/1.jpg",
      "/photos/vassa/2.jpg",
      "/photos/vassa/3.jpg",
      "/photos/vassa/4.jpg",
      "/photos/vassa/5.jpg",
      "/photos/vassa/6.jpg",
      "/photos/vassa/7.jpg",
      "/photos/vassa/8.jpg",
      "/photos/vassa/9.jpg",
      "/photos/vassa/10.jpg",
      "/photos/vassa/12.jpg",
      "/photos/vassa/13.jpg",
      "/photos/vassa/14.jpg",
    ],
    eventPageBg: "/photos/vassa/0.jpg",
    disableGlass: true,
    reviews: [...VASSA_ZHELEZNOVA_REVIEWS],
    cast: [],
  },
  {
    slug: "заклятие",
    soon: false,
    name: "Заклятие",
    subtitle: "",
    old: "",
    type: "",
    anonse:
      'Комедия в двух действиях по пьесе Нила Саймона \"Дураки\" Леон Степанович, молодой учитель, приезжает в глухую деревню в надежде раскрыть весь свой потенциал. Он действует по приглашению местного доктора Зубрицкого, который мечтает, чтобы его дочь получила образование. На первый взгляд — совершенно обычная история. Но всё меняется с первых минут. Леон замечает странности в поведении местных жителей: другие учителя почему-то не задерживаются дольше суток, а в самой деревне витает что-то... неладное. Доктор Зубрицкий раскрывает тайну: вот уже 200 лет все жители деревни рождаются и умирают дураками — из-за страшного и древнего заклятия. Если Леон не уедет в течение 24 часов, то и сам навсегда потеряет разум.Он собирается уехать, но... влюбляется в дочь доктора. Теперь перед ним стоит выбор: либо он научит деревню хоть чему-то, либо навсегда останется одним из них. А времени — всё меньше.',
    date: "",
    cardImage: "afisha-2.jpg",
    colorBackground: 0x01172f,
    photos: [
      "/photos/fools/0.jpg",
      "/photos/fools/1.jpg",
      "/photos/fools/2.jpg",
      "/photos/fools/3.jpg",
      "/photos/fools/5.jpg",
      "/photos/fools/6.jpg",
      "/photos/fools/7.jpg",
      "/photos/fools/8.jpg",
    ],
    eventPageBg: "/photos/fools/0.jpg",
    cast: [
      { role: "Леон", actor: "Григорий Найденов" },
      { role: "Софья", actor: "Полина Смолкина" },
      { role: "Доктор Зубрицкий", actor: "Сергей Луняка" },
      { role: "Госпожа Зубрицкая", actor: "Анастасия Рябых" },
      { role: "Граф", actor: "Анатон Васильев" },
      { role: "Слович", actor: "Валерий Рутковский" },
      { role: "Янка", actor: "Екатерина Слыхановская" },
      { role: "Почтальон Мышкин", actor: "Алексей Филатов" },
      { role: "Снецкий", actor: "Вероника Атушева" },
      { role: "Барашек", actor: "Лера Буракова" },
    ],
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
    colorBackground: 0x6b0f1a,
    photos: ["/images/show1.jpg", "/images/show2.jpg", "/images/show3.jpg"],
    cast: [],
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
    colorBackground: 0x6b0f1a,
    photos: ["/images/show1.jpg", "/images/show2.jpg", "/images/show3.jpg"],
    cast: [],
  },
];

const EventPage: FC = () => {
  const { eventSlug } = useParams();
  const [events, setEvents] = useState<SiteEvent[]>(FALLBACK_EVENTS);
  const eventsPath = ROUTES.EVENTS.startsWith("/") ? ROUTES.EVENTS : `/${ROUTES.EVENTS}`;

  useEffect(() => {
    let alive = true;
    fetchSiteEvents()
      .then((remote) => {
        if (!alive) return;
        if (remote && remote.length) {
          setEvents(mergeSiteEventsWithFallback(remote, FALLBACK_EVENTS));
        }
      })
      .catch(() => {
        // ignore: fallback is already shown
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const slug = (eventSlug ?? "").trim();
    if (!slug) return;
    const key = `site:event-viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // ignore storage issues
    }
    void hitSiteEventView(slug);
  }, [eventSlug]);

  const curentEvent = events.find((E) => E.slug === eventSlug);
  const isZaklyatie = (eventSlug ?? "").trim().toLowerCase() === "заклятие";
  const [atmosphereRoot, setAtmosphereRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const page = document.querySelector(".chalk-page");
    if (!(page instanceof HTMLElement) || !curentEvent) return;
    if (isZaklyatie) setAtmosphereRoot(page);
    const tint = eventTint(curentEvent.colorBackground);
    const picture = isZaklyatie ? "" : curentEvent.eventPageBg?.trim();
    if (tint) page.style.setProperty("--afisha-page-bg", tint);
    if (picture) page.style.setProperty("--event-page-bg", `url("${siteAsset(picture)}")`);
    return () => {
      page.style.removeProperty("--afisha-page-bg");
      page.style.removeProperty("--event-page-bg");
    };
  }, [curentEvent, isZaklyatie]);

  if (!curentEvent) {
    return (
      <ChalkPageShell
        mainClassName="chalk-page__main--event"
        scrollable
        showHomeBack
        showSectionNav={false}
        homeBackTo={eventsPath}
        homeBackLabel="На афишу"
      >
        <p className="chalk-event__status" role="status">Спектакль не найден</p>
      </ChalkPageShell>
    );
  }

  const title = curentEvent.name?.trim() || "Спектакль";

  const cast = Array.isArray(curentEvent.cast) ? curentEvent.cast : null;
  const reviews = Array.isArray(curentEvent.reviews) ? curentEvent.reviews : [];
  const reviewImages = Array.isArray(curentEvent.reviewImages) ? curentEvent.reviewImages : [];

  const ticketsCloudEventId = curentEvent.ticketsCloudEventId?.trim() || "";
  const ticketsCloudToken = curentEvent.ticketsCloudToken?.trim() || "";
  const hasTicketsCloud = Boolean(ticketsCloudEventId || ticketsCloudToken);
  const howToFindVideoUrl = "https://vk.com/video-81928625_456239136";

  const rainAudioUrlRaw = curentEvent.rainAudioUrl?.trim() || "";
  const rainButtonLabel = curentEvent.rainButtonLabel?.trim() || "Дождь";
  const showRainToggle = Boolean(rainAudioUrlRaw);
  const rainAudioUrl =
    rainAudioUrlRaw && (isAbsoluteUrl(rainAudioUrlRaw) || rainAudioUrlRaw.startsWith("/minio/"))
      ? rainAudioUrlRaw
      : rainAudioUrlRaw
        ? siteAsset(rainAudioUrlRaw)
        : "";

  const ogImageCandidate = curentEvent.cardImage?.trim()
    ? curentEvent.cardImage.trim()
    : curentEvent.photos?.[0]
      ? curentEvent.photos[0]
      : "";

  const origin =
    typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  const canonicalUrl =
    origin && eventSlug ? `${origin}${eventsPath}/${encodeURIComponent(eventSlug)}` : "";
  const ogImageResolved = ogImageCandidate ? siteAsset(ogImageCandidate) : "";
  const ogImageUrl =
    ogImageResolved && isAbsoluteUrl(ogImageResolved)
      ? ogImageResolved
      : origin && ogImageResolved
        ? `${origin}${ogImageResolved}`
        : "";

  const descriptionText =
    (curentEvent.anonse || "").replace(/\s+/g, " ").trim() ||
    "Спектакль театра Дофамин. Афиша, фото и описание.";
  const metaDescription =
    descriptionText.length > 170 ? `${descriptionText.slice(0, 167).trim()}…` : descriptionText;

  const isoStartDate = (() => {
    const raw = (curentEvent.date ?? "").trim();
    if (!raw) return undefined;
    // Accept ISO 8601 date/datetime if provided by remote content.
    if (/^\d{4}-\d{2}-\d{2}([tT]\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|[zZ])?)?$/.test(raw)) {
      return raw;
    }
    return undefined;
  })();

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Дофамин",
        item: origin ? `${origin}/` : undefined,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Спектакли",
        item: origin ? `${origin}${eventsPath}` : undefined,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: title,
        item: canonicalUrl || undefined,
      },
    ],
  };

  const eventLd = {
    "@context": "https://schema.org",
    "@type": "TheaterEvent",
    name: title,
    description: descriptionText,
    inLanguage: "ru-RU",
    ...(canonicalUrl ? { url: canonicalUrl } : null),
    ...(ogImageUrl ? { image: [ogImageUrl] } : null),
    ...(isoStartDate ? { startDate: isoStartDate } : null),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: "Театр «Дофамин»",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Санкт-Петербург",
        addressCountry: "RU",
      },
    },
    organizer: {
      "@type": "TheaterGroup",
      name: "Театр «Дофамин»",
      ...(origin ? { url: origin } : null),
    },
    ...(cast && cast.length
      ? {
        performer: cast
          .map((x) => (x?.actor ? String(x.actor).trim() : ""))
          .filter(Boolean)
          .map((name) => ({ "@type": "Person", name })),
      }
      : null),
    ...(hasTicketsCloud && canonicalUrl
      ? {
        offers: {
          "@type": "Offer",
          url: canonicalUrl,
          availability: curentEvent.soon
            ? "https://schema.org/PreOrder"
            : "https://schema.org/InStock",
          priceCurrency: "RUB",
        },
      }
      : null),
  };

  const photos = (curentEvent.photos ?? []).map(siteAsset);
  const ageLabel = curentEvent.old?.trim() || "";
  const hasMetaChips = curentEvent.soon || Boolean(curentEvent.type?.trim());

  return (
    <ChalkPageShell
      mainClassName="chalk-page__main--event"
      scrollable
      showHomeBack
      showSectionNav={false}
      homeBackTo={eventsPath}
      homeBackLabel="На афишу"
    >
      {isZaklyatie &&
        atmosphereRoot &&
        createPortal(
          <ZaklyatieAtmosphere fallbackSrc={photos[0]} />,
          atmosphereRoot,
        )}

      {showRainToggle && (
        <div className="chalk-event__rain">
          <RainAmbienceToggle url={rainAudioUrl} label={rainButtonLabel} />
        </div>
      )}

      <Seo
        title={`${title} — Дофамин`}
        description={metaDescription}
        canonicalPath={eventSlug ? `${eventsPath}/${encodeURIComponent(eventSlug)}` : undefined}
        imageUrl={ogImageUrl}
        jsonLd={[breadcrumbLd, eventLd]}
      />

      {hasMetaChips && (
        <div className="chalk-event__chips" aria-label="Характеристики спектакля">
          {curentEvent.soon && <span className="chalk-event__chip">скоро</span>}
          {curentEvent.type?.trim() && (
            <span className="chalk-event__chip">{curentEvent.type.trim()}</span>
          )}
        </div>
      )}

      <div className="chalk-event__heading">
        <h1 className="chalk-page__title chalk-event__title">{title}</h1>
        {ageLabel && <span className="chalk-event__chip chalk-event__age">{ageLabel}</span>}
      </div>
      {curentEvent.subtitle?.trim() && (
        <p className="chalk-page__subtitle">{curentEvent.subtitle.trim()}</p>
      )}
      <div className="chalk-page__rule" aria-hidden />

      {photos.length > 0 && (
        <section className="chalk-event__photo" aria-label="Фотографии спектакля">
          <PhotoCarousel images={photos} title={title} />
          {hasTicketsCloud && (
            <div className="chalk-event__tickets-side">
              {ticketsCloudEventId && ticketsCloudToken ? (
                <button
                  type="button"
                  className="chalk-event__tickets-btn"
                  data-tc-event={ticketsCloudEventId}
                  data-tc-token={ticketsCloudToken}
                >
                  Купить билет
                </button>
              ) : (
                <span className="chalk-event__row-meta">скоро в продаже</span>
              )}
            </div>
          )}
        </section>
      )}

      {curentEvent.anonse?.trim() && (
        <section className="chalk-event__about" aria-label="Описание спектакля">
          <p className="chalk-event__description">{curentEvent.anonse}</p>
        </section>
      )}

      <div className="chalk-event__list" role="list" aria-label="Действия">
        {hasTicketsCloud && (
          <div className="chalk-event__row chalk-event__row--tickets" role="listitem">
            <span className="chalk-event__row-title">Билеты</span>
            {ticketsCloudEventId && ticketsCloudToken ? (
              <button
                type="button"
                className="chalk-event__tickets-btn"
                data-tc-event={ticketsCloudEventId}
                data-tc-token={ticketsCloudToken}
              >
                Купить билет
              </button>
            ) : (
              <span className="chalk-event__row-meta">скоро в продаже</span>
            )}
          </div>
        )}

        <a
          className="chalk-event__row chalk-event__row--link"
          href={howToFindVideoUrl}
          target="_blank"
          rel="noopener noreferrer"
          role="listitem"
        >
          <span className="chalk-event__row-title chalk-event__find">Как нас найти</span>
          <span className="chalk-event__row-meta chalk-event__video">видео</span>
        </a>
      </div>

      {cast && cast.length > 0 && (
        <section className="chalk-event__section" aria-label="Состав">
          <h2 className="chalk-event__section-title">Состав</h2>
          <div className="chalk-event__list" role="list">
            {cast.map((item) => {
              const roleName = (item.role || "").trim() || "роль";
              const actorName = (item.actor || "").trim() || "—";
              return (
                <div key={`${roleName}-${actorName}`} className="chalk-event__row" role="listitem">
                  <span className="chalk-event__row-title">{actorName}</span>
                  <span className="chalk-event__row-meta">{roleName}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="chalk-event__section" aria-label="Отзывы">
          <h2 className="chalk-event__section-title">Отзывы</h2>
          <div className="chalk-event__band">
            <ReviewsSlider reviews={reviews} />
          </div>
        </section>
      )}

      {reviewImages.length > 0 && (
        <section className="chalk-event__section" aria-label="Отзывы (фото)">
          <h2 className="chalk-event__section-title">Отзывы (фото)</h2>
          <div className="chalk-event__band">
            <ReviewImagesSlider images={reviewImages.map((p) => siteAsset(p))} />
          </div>
        </section>
      )}

      {(reviews.length > 0 || reviewImages.length > 0) && (
        <p className="chalk-event__reviews-hint" aria-label="Где оставить отзыв">
          Вы можете оставить свой комментарий на наших ресурсах:{" "}
          <a href="https://t.me/dofamintheatre" target="_blank" rel="noopener noreferrer">
            @dofamintheatre
          </a>{" "}
          и{" "}
          <a href="https://vk.com/dofaminspb" target="_blank" rel="noopener noreferrer">
            vk.com/dofaminspb
          </a>
          .
        </p>
      )}
      {curentEvent.showSideOnEvent !== false && curentEvent.sideImage?.trim() && (
        <EventSideSplit src={siteAsset(curentEvent.sideImage.trim())} title={title} />
      )}
    </ChalkPageShell>
  );
};

export const Component = EventPage;

function eventTint(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const color = value & 0xffffff;
  const red = (color >> 16) & 255;
  const green = (color >> 8) & 255;
  const blue = color & 255;
  return `rgba(${red}, ${green}, ${blue}, 0.2)`;
}

function EventSideSplit({ src, title }: { src: string; title: string }) {
  return createPortal(
    <div className="chalk-afisha-board chalk-afisha-board--page">
      <div className="chalk-afisha-board__poster chalk-afisha-board__poster--left">
        <img className="chalk-afisha-board__img" src={src} alt="" />
      </div>
      <div className="chalk-afisha-board__poster chalk-afisha-board__poster--right">
        <img className="chalk-afisha-board__img" src={src} alt={title} />
      </div>
    </div>,
    document.body
  );
}

interface PhotoCarouselProps {
  images: string[];
  title: string;
}

type Review = { text: string; author?: string };

function ReviewsSlider({ reviews }: { reviews: Review[] }) {
  const normalized = reviews
    .map((r) => ({ text: String(r.text ?? "").trim(), author: (r.author ?? "").trim() }))
    .filter((r) => r.text.length > 0);
  const [active, setActive] = useState(0);
  const total = normalized.length;

  return (
    <div className="reviews-slider">
      <div className="reviews-slider__counter" aria-label="Счётчик отзывов">
        {total ? `${Math.min(active + 1, total)} / ${total}` : "—"}
      </div>
      <Swiper
        modules={[Navigation, Pagination]}
        navigation
        pagination={{ clickable: true }}
        slidesPerView={1}
        spaceBetween={12}
        autoHeight
        onSlideChange={(s: SwiperClass) => setActive(s.realIndex ?? 0)}
        className="reviews-slider__swiper"
      >
        {normalized.map((r, idx) => {
          const author = r.author;
          const text = r.text;
          return (
            <SwiperSlide key={`${idx}-${author || "review"}`} className="reviews-slider__slide">
              <figure className="reviews-slider__card">
                <blockquote className="reviews-slider__text">“{text}”</blockquote>
                {author && <figcaption className="reviews-slider__author">— {author}</figcaption>}
              </figure>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}

function ReviewImagesSlider({ images }: { images: string[] }) {
  const normalized = (images ?? []).map((s) => String(s ?? "").trim()).filter(Boolean);
  const [active, setActive] = useState(0);
  const total = normalized.length;

  return (
    <div className="reviews-slider">
      <div className="reviews-slider__counter" aria-label="Счётчик фото-отзывов">
        {total ? `${Math.min(active + 1, total)} / ${total}` : "—"}
      </div>
      <Swiper
        modules={[Navigation, Pagination]}
        navigation
        pagination={{ clickable: true }}
        slidesPerView={1}
        spaceBetween={12}
        autoHeight
        onSlideChange={(s: SwiperClass) => setActive(s.realIndex ?? 0)}
        className="reviews-slider__swiper"
      >
        {normalized.map((src, idx) => (
          <SwiperSlide key={`${idx}-${src}`} className="reviews-slider__slide">
            <div className="reviews-slider__imgCard">
              <ImageWithPreloader
                className="reviews-slider__imgWrap"
                imgClassName="reviews-slider__img"
                src={src}
                alt={`Отзыв — фото ${idx + 1}`}
                loading="lazy"
                decoding="async"
                spinnerSize={54}
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}

function PhotoCarousel({ images, title }: PhotoCarouselProps) {
  const [mainSwiper, setMainSwiper] = useState<SwiperClass | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!mainSwiper || mainSwiper.destroyed) return;
    const refresh = () => {
      if (mainSwiper.destroyed) return;
      mainSwiper.update();
      mainSwiper.slideToLoop(mainSwiper.realIndex, 0, false);
    };
    const frame = requestAnimationFrame(refresh);
    const timer = window.setTimeout(refresh, 60);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [mainSwiper, images.length]);

  return (
    <div className="event-carousel">
      {/* Основной слайдер */}
      <Swiper
        modules={[Navigation]}
        navigation
        centeredSlides
        slideToClickedSlide
        onSwiper={setMainSwiper}
        spaceBetween={12}
        slidesPerView={1}
        loop
        loopAdditionalSlides={4}
        observer
        observeParents
        breakpoints={{
          900: { slidesPerView: 2.15, spaceBetween: 14, centeredSlides: true },
        }}
        onSlideChange={(swiper: SwiperClass) =>
          setActiveIndex(swiper.realIndex)
        }
        className="event-carousel__main"
      >
        {images.map((src, index) => (
          <SwiperSlide key={index}>
            <div
              className="event-carousel__frame"
              style={
                {
                  ["--carousel-bg" as any]: `url("${src}")`,
                } satisfies CSSProperties
              }
            >
              <ImageWithPreloader
                className="event-carousel__imgWrap"
                imgClassName="event-carousel__img"
                src={src}
                alt={`${title} — фото ${index + 1}`}
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                spinnerSize={64}
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Миниатюрный слайдер */}
      <Swiper
        modules={[Navigation]}
        spaceBetween={10}
        slidesPerView={4}
        navigation
        slideToClickedSlide
        onSlideChange={(swiper: SwiperClass) => mainSwiper?.slideToLoop(swiper.realIndex)}
        className="event-carousel__thumbs"
      >
        {images.map((src, index) => (
          <SwiperSlide
            key={index}
            className="event-carousel__thumbSlide"
            onClick={() => mainSwiper?.slideToLoop(index)}
          >
            <ImageWithPreloader
              className="event-carousel__thumbWrap"
              imgClassName={
                index === activeIndex
                  ? "event-carousel__thumbImg event-carousel__thumbImg--active"
                  : "event-carousel__thumbImg"
              }
              src={src}
              alt={`${title} — миниатюра ${index + 1}`}
              loading="lazy"
              decoding="async"
              spinnerSize={34}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}

export default PhotoCarousel;

type RainDrop = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  trail: number;
  wobble: number;
};

function ZaklyatieAtmosphere({ fallbackSrc }: { fallbackSrc?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef(0);
  const dropsRef = useRef<RainDrop[]>([]);
  const [bgSrc, setBgSrc] = useState(
    "https://i.pinimg.com/1200x/f1/35/9b/f1359b0d0d57d5b89e1134113ebe8fd1.jpg",
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const createDrop = (w: number, h: number): RainDrop => {
      const r = 1.6 + Math.random() * 4.8;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r,
        vx: (-0.2 + Math.random() * 0.4) * 30,
        vy: (0.6 + Math.random() * 1.8) * (70 + r * 22),
        trail: 18 + Math.random() * 70,
        wobble: Math.random() * Math.PI * 2,
      };
    };

    const setSize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      canvas.width = w;
      canvas.height = h;

      const area = (w * h) / (dpr * dpr);
      const count = Math.max(70, Math.min(260, Math.floor(area / 9000)));
      dropsRef.current = Array.from({ length: count }, () => createDrop(w, h));
    };

    const draw = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const dt = Math.min(0.033, lastTRef.current ? (t - lastTRef.current) / 1000 : 0.016);
      lastTRef.current = t;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const drops = dropsRef.current;
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.wobble += dt * (0.8 + d.r * 0.2);
        const wind = Math.sin(d.wobble) * 10;
        d.x += (d.vx + wind) * dt;
        d.y += d.vy * dt;

        if (d.y - d.trail > h + 30) {
          d.y = -20 - Math.random() * 120;
          d.x = Math.random() * w;
          d.r = 1.6 + Math.random() * 4.8;
          d.vx = (-0.2 + Math.random() * 0.4) * 30;
          d.vy = (0.6 + Math.random() * 1.8) * (70 + d.r * 22);
          d.trail = 18 + Math.random() * 70;
          d.wobble = Math.random() * Math.PI * 2;
        }
        if (d.x < -40) d.x = w + 40;
        if (d.x > w + 40) d.x = -40;

        const trailLen = d.trail * (0.75 + d.r * 0.06);
        const trail = ctx.createLinearGradient(d.x, d.y - trailLen, d.x, d.y);
        trail.addColorStop(0, "rgba(255,255,255,0)");
        trail.addColorStop(0.6, "rgba(255,255,255,0.08)");
        trail.addColorStop(1, "rgba(255,255,255,0.18)");
        ctx.strokeStyle = trail;
        ctx.lineWidth = Math.max(0.8, d.r * 0.55);
        ctx.beginPath();
        ctx.moveTo(d.x, d.y - trailLen);
        ctx.lineTo(d.x, d.y + d.r * 1.5);
        ctx.stroke();

        const headRadius = d.r * 2.1;
        const head = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, headRadius);
        head.addColorStop(0, "rgba(255,255,255,0.36)");
        head.addColorStop(0.35, "rgba(255,255,255,0.16)");
        head.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = head;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, headRadius * 0.62, headRadius, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = window.requestAnimationFrame(draw);
    };

    setSize();
    window.addEventListener("resize", setSize);

    if (!prefersReduced) {
      rafRef.current = window.requestAnimationFrame(draw);
    }

    return () => {
      window.removeEventListener("resize", setSize);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  return (
    <div className="zaklyatie-atmosphere" aria-hidden="true">
      <img
        className="zaklyatie-atmosphere__bg"
        src={bgSrc}
        alt=""
        onError={() => {
          if (fallbackSrc && bgSrc !== fallbackSrc) setBgSrc(fallbackSrc);
        }}
      />
      <canvas ref={canvasRef} className="zaklyatie-atmosphere__canvas" />
      <div className="zaklyatie-atmosphere__glass" />
    </div>
  );
}

function RainAmbienceToggle({ url, label }: { url: string; label: string }) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const noiseSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const mediaElRef = useRef<HTMLAudioElement | null>(null);
  const mediaSrcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [isOn, setIsOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const startingRef = useRef(false);

  const rainUrl = url;
  const DEFAULT_VOLUME = 0.18;

  const stop = () => {
    try {
      mediaElRef.current?.pause();
      if (mediaElRef.current) mediaElRef.current.currentTime = 0;
    } catch {
      // ignore
    }
    mediaSrcRef.current?.disconnect();
    mediaSrcRef.current = null;
    if (mediaElRef.current) {
      // release network resources
      mediaElRef.current.src = "";
    }
    mediaElRef.current = null;

    try {
      noiseSrcRef.current?.stop();
    } catch {
      // ignore
    }
    noiseSrcRef.current?.disconnect();
    noiseSrcRef.current = null;

    gainRef.current?.disconnect();
    gainRef.current = null;

    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== "closed") {
      ctx.close().catch(() => { });
    }
  };

  const start = async () => {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;

    // Ensure we never overlap multiple sources/contexts.
    stop();

    const origin =
      typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
    const isAbsolute = /^https?:\/\//i.test(rainUrl);
    const isCrossOrigin = Boolean(origin && isAbsolute && !rainUrl.startsWith(origin));

    // For cross-origin URLs prefer <audio> directly (WebAudio often fails due to CORS).
    if (isCrossOrigin || !Ctx) {
      const el = new Audio();
      el.crossOrigin = "anonymous";
      el.src = rainUrl;
      el.loop = true;
      el.preload = "auto";
      el.volume = DEFAULT_VOLUME;
      mediaElRef.current = el;
      await el.play();
      return;
    }

    const ctx: AudioContext = new Ctx();
    audioCtxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = DEFAULT_VOLUME;
    master.connect(ctx.destination);
    gainRef.current = master;

    try {
      const res = await fetch(rainUrl, { cache: "force-cache" });
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.loop = true;
      noiseSrcRef.current = src;

      src.connect(master);
      src.start();
    } catch {
      // Fallback for external URLs that block fetch/decode by CORS:
      // play via <audio> and route into WebAudio for volume control.
      try {
        const el = new Audio();
        el.crossOrigin = "anonymous";
        el.src = rainUrl;
        el.loop = true;
        el.preload = "auto";
        el.volume = DEFAULT_VOLUME;

        try {
          const node = ctx.createMediaElementSource(el);
          node.connect(master);
          mediaElRef.current = el;
          mediaSrcRef.current = node;
          await el.play();
        } catch {
          // Some hosts allow playback but disallow WebAudio connection (CORS taint).
          // In that case just play the audio element directly.
          stop();
          mediaElRef.current = el;
          mediaSrcRef.current = null;
          await el.play();
        }
      } catch {
        stop();
      }
    }
  };

  useEffect(() => {
    return () => stop();
  }, []);

  return (
    <button
      type="button"
      className={isOn ? "chalk-event__rain-toggle is-on" : "chalk-event__rain-toggle"}
      aria-pressed={isOn}
      aria-label={isOn ? `${label}: выключить` : `${label}: включить`}
      disabled={isLoading}
      aria-busy={isLoading}
      onClick={async () => {
        if (startingRef.current) return;
        if (isLoading) return;

        if (isOn) {
          stop();
          setIsOn(false);
          return;
        }

        startingRef.current = true;
        setIsLoading(true);
        try {
          await start();
          // Некоторые браузеры создают контекст в suspended — попробуем возобновить.
          if (audioCtxRef.current?.state === "suspended") {
            await audioCtxRef.current.resume().catch(() => { });
          }
          setIsOn(true);
        } finally {
          startingRef.current = false;
          setIsLoading(false);
        }
      }}
    >
      <svg className="chalk-event__rain-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M9 18.5a2.5 2.5 0 1 1-1.8-2.4V6.2L19 4v9.3a2.5 2.5 0 1 1-1.8-2.4V7.2L9 8.8v9.7z"
          fill="currentColor"
        />
        {!isOn && <path className="chalk-event__rain-slash" d="M4 20 L20 4" />}
      </svg>
    </button>
  );
}
