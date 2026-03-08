/* eslint-disable no-useless-escape */
import { CSSProperties, FC, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Controller, Navigation } from "swiper/modules";
import { Swiper, SwiperClass, SwiperSlide } from "swiper/react";
import { ROUTES } from "../../shared/model/routes";
import "./style.css";

const EVENTS = [
  {
    id: "1",
    soon: false,
    name: "Железнова",
    subtitle: "",
    old: "",
    anonse:
      'Это не просто история о прошлом. Это размышление о времени, идеологии и вечных вопросах: что важнее — семья, долг или личные убеждения? Наш спектакль поставлен по второй редакции пьесы — последней работе Горького. Это рассказ о схватке между старым и новым, где каждая сторона по-своему права и по-своему несчастна. Железнова — сильная, но одинокая женщина. Она продолжает жить "как положено", сохраняя семейное дело и защищая его от любых угроз. Её жизнь — как пароход: идёт вперёд, не жалея себя и других. Её философия проста: "Дети — руки мои, внуки — пальцы мои". Она верит, что её долг — сохранить груз прошлого, чтобы передать его в будущее. Но её дети — это уже другое время, другие идеи. Между ними разворачивается схватка за смысл жизни, за право на своё будущее. Символом этого будущего становится маленький Коля, сын Рахиль и внук Вассы. За него борются идеалы двух эпох.',
    date: "",
    img: "vassa-afisha.jpg",
    type: "",
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
  },
  {
    id: "2",
    soon: false,
    name: "Заклятие",
    subtitle: "",
    old: "",
    type: "",
    anonse:
      'Комедия в двух действиях по пьесе Нила Саймона \"Дураки\" Леон Степанович, молодой учитель, приезжает в глухую деревню в надежде раскрыть весь свой потенциал. Он действует по приглашению местного доктора Зубрицкого, который мечтает, чтобы его дочь получила образование. На первый взгляд — совершенно обычная история. Но всё меняется с первых минут. Леон замечает странности в поведении местных жителей: другие учителя почему-то не задерживаются дольше суток, а в самой деревне витает что-то... неладное. Доктор Зубрицкий раскрывает тайну: вот уже 200 лет все жители деревни рождаются и умирают дураками — из-за страшного и древнего заклятия. Если Леон не уедет в течение 24 часов, то и сам навсегда потеряет разум.Он собирается уехать, но... влюбляется в дочь доктора. Теперь перед ним стоит выбор: либо он научит деревню хоть чему-то, либо навсегда останется одним из них. А времени — всё меньше.',
    date: "",
    img: "afisha-2.jpg",
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
  },
  {
    id: "3",
    soon: true,
    name: "Зойкина квартирка",
    subtitle: "Узнать больше",
    old: "18+",
    type: "трагикомедия",
    anonse: "",
    date: "февраль",
    img: "https://i.pinimg.com/736x/6c/de/d0/6cded009506170d47a5865ae6854bcf4.jpg",
    colorBackground: 0x6b0f1a,
    photos: ["/images/show1.jpg", "/images/show2.jpg", "/images/show3.jpg"],
  },
  {
    id: "4",
    soon: true,
    name: "Чехов Дуэль",
    subtitle: "Узнать больше",
    old: "18+",
    type: "трагикомедия",
    anonse: "",
    date: "март",
    img: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1583&q=80",
    colorBackground: 0x6b0f1a,
    photos: ["/images/show1.jpg", "/images/show2.jpg", "/images/show3.jpg"],
  },
];

const EventPage: FC = () => {
  const { eventId } = useParams();

  const curentEvent = EVENTS.find((E) => E.id === eventId);

  if (!curentEvent) {
    return <div>Событие не найдено</div>;
  }

  const title = curentEvent.name?.trim() || "Спектакль";
  const subtitle = curentEvent.subtitle?.trim();

  const eventAccent =
    typeof curentEvent.colorBackground === "number"
      ? `#${curentEvent.colorBackground.toString(16).padStart(6, "0")}`
      : undefined;

  const style = eventAccent
    ? ({
        ["--event-accent" as any]: eventAccent,
      } satisfies CSSProperties)
    : undefined;

  const eventsPath = ROUTES.EVENTS.startsWith("/") ? ROUTES.EVENTS : `/${ROUTES.EVENTS}`;

  const normalizePublicPath = (p: string) => {
    if (!p) return p;
    if (p.startsWith("http://") || p.startsWith("https://")) return p;
    return p.startsWith("/") ? p : `/${p}`;
  };

  const ogImageCandidate = curentEvent.img?.trim()
    ? normalizePublicPath(curentEvent.img.trim())
    : curentEvent.photos?.[0]
      ? normalizePublicPath(curentEvent.photos[0])
      : "";

  const origin =
    typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  const canonicalUrl =
    origin && eventId ? `${origin}${eventsPath}/${encodeURIComponent(eventId)}` : "";
  const ogImageUrl = origin && ogImageCandidate ? `${origin}${ogImageCandidate}` : "";

  const descriptionText =
    (curentEvent.anonse || "").replace(/\s+/g, " ").trim() ||
    "Спектакль театра Дофамин. Афиша, фото и описание.";
  const metaDescription =
    descriptionText.length > 170 ? `${descriptionText.slice(0, 167).trim()}…` : descriptionText;

  return (
    <div className="event-page" style={style}>
      <Helmet>
        <title>{`${title} — Дофамин`}</title>
        <meta name="description" content={metaDescription} />

        {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Дофамин" />
        <meta property="og:title" content={`${title} — Дофамин`} />
        <meta property="og:description" content={metaDescription} />
        {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
        {ogImageUrl && <meta property="og:image" content={ogImageUrl} />}

        <meta name="twitter:card" content={ogImageUrl ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={`${title} — Дофамин`} />
        <meta name="twitter:description" content={metaDescription} />
        {ogImageUrl && <meta name="twitter:image" content={ogImageUrl} />}
      </Helmet>

      <div className="event-page__content">
        <Link to={eventsPath} className="events-page__back">
          Назад
        </Link>

        <header className="event-page__header">
          <h1 className="event-page__title">{title}</h1>
          {subtitle && <p className="event-page__subtitle">{subtitle}</p>}

          <div className="event-page__meta" aria-label="Характеристики спектакля">
            {curentEvent.soon && <span className="event-page__chip">скоро</span>}
            {curentEvent.old?.trim() && (
              <span className="event-page__chip">{curentEvent.old.trim()}</span>
            )}
            {curentEvent.type?.trim() && (
              <span className="event-page__chip">{curentEvent.type.trim()}</span>
            )}
            {curentEvent.date?.trim() && (
              <span className="event-page__chip">{curentEvent.date.trim()}</span>
            )}
          </div>
        </header>

        <div className="event-page__main">
          <section className="event-page__gallery" aria-label="Фотографии спектакля">
            <PhotoCarousel images={curentEvent.photos} title={title} />
          </section>

          <section className="event-page__text" aria-label="Описание спектакля">
            <div className="event-page__description">{curentEvent.anonse}</div>
          </section>
        </div>
      </div>
    </div>
  );
};

export const Component = EventPage;

interface PhotoCarouselProps {
  images: string[];
  title: string;
}

function PhotoCarousel({ images, title }: PhotoCarouselProps) {
  const [mainSwiper, setMainSwiper] = useState<SwiperClass | null>(null);
  const [thumbSwiper, setThumbSwiper] = useState<SwiperClass | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="event-carousel">
      {/* Основной слайдер */}
      <Swiper
        modules={[Controller]}
        onSwiper={setMainSwiper}
        controller={{ control: thumbSwiper }}
        spaceBetween={10}
        slidesPerView={1}
        loop={true}
        onSlideChange={(swiper: SwiperClass) =>
          setActiveIndex(swiper.realIndex)
        }
        className="event-carousel__main"
      >
        {images.map((src, index) => (
          <SwiperSlide key={index}>
            <img src={src} alt={`${title} — фото ${index + 1}`} className="event-carousel__img" />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Миниатюрный слайдер */}
      <Swiper
        modules={[Navigation, Controller]}
        onSwiper={setThumbSwiper}
        controller={{ control: mainSwiper }} // <- теперь нижний управляет верхним
        spaceBetween={10}
        slidesPerView={4}
        navigation
        // loop={true}
        slideToClickedSlide={true} // клики по миниатюрам меняют большой слайд
        className="event-carousel__thumbs"
      >
        {images.map((src, index) => (
          <SwiperSlide key={index} className="event-carousel__thumbSlide">
            <img
              src={src}
              alt={`${title} — миниатюра ${index + 1}`}
              className={
                index === activeIndex
                  ? "event-carousel__thumbImg event-carousel__thumbImg--active"
                  : "event-carousel__thumbImg"
              }
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}

export default PhotoCarousel;
