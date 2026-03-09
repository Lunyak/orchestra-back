/* eslint-disable no-useless-escape */
import { CSSProperties, FC, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Controller, Navigation } from "swiper/modules";
import { Swiper, SwiperClass, SwiperSlide } from "swiper/react";
import { CastList } from "../../shared/component/CastList/CastList";
import { ImageWithPreloader } from "../../shared/component/ImageWithPreloader/ImageWithPreloader";
import { ROUTES } from "../../shared/model/routes";
import type { SiteEvent } from "../../shared/model/siteContent";
import { fetchSiteEvents } from "../../shared/model/siteContent";
import { isAbsoluteUrl, siteAsset } from "../../shared/model/siteAssets";
import { GlitchHero } from "../HomePage/GlitchHero";
import "./style.css";

const FALLBACK_EVENTS: SiteEvent[] = [
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
    cast: [],
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
    cast: [],
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
    cast: [],
  },
];

const EventPage: FC = () => {
  const { eventId } = useParams();

  const [events, setEvents] = useState<SiteEvent[]>(FALLBACK_EVENTS);

  useEffect(() => {
    let alive = true;
    fetchSiteEvents()
      .then((remote) => {
        if (!alive) return;
        if (remote && remote.length) setEvents(remote);
      })
      .catch(() => {
        // ignore: fallback is already shown
      });
    return () => {
      alive = false;
    };
  }, []);

  const curentEvent = events.find((E) => E.id === eventId);

  if (!curentEvent) {
    return <div>Событие не найдено</div>;
  }

  const title = curentEvent.name?.trim() || "Спектакль";
  const subtitle = curentEvent.subtitle?.trim();

  const isZaklyatie =
    (curentEvent.name || "").trim().toLowerCase().replace(/[.\s]+$/g, "") === "заклятие";

  const cast = Array.isArray(curentEvent.cast) ? curentEvent.cast : null;

  const ticketsCloudEventId = process.env.REACT_APP_TC_ZAKLYATIE_EVENT_ID;
  const ticketsCloudToken = process.env.REACT_APP_TC_ZAKLYATIE_TOKEN;

  const eventAccent =
    typeof curentEvent.colorBackground === "number"
      ? `#${curentEvent.colorBackground.toString(16).padStart(6, "0")}`
      : undefined;

  const style = {
    ...(eventAccent ? ({ ["--event-accent" as any]: eventAccent } satisfies CSSProperties) : null),
    ...(isZaklyatie
      ? ({
        // Позже просто положи файл в public/bg/zaklyatie-village.jpg
        ["--zaklyatie-bg-url" as any]: 'url("/bg/zaklyatie-village.jpg")',
      } satisfies CSSProperties)
      : null),
  } as CSSProperties;

  const eventsPath = ROUTES.EVENTS.startsWith("/") ? ROUTES.EVENTS : `/${ROUTES.EVENTS}`;

  const ogImageCandidate = curentEvent.img?.trim()
    ? curentEvent.img.trim()
    : curentEvent.photos?.[0]
      ? curentEvent.photos[0]
      : "";

  const origin =
    typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  const canonicalUrl =
    origin && eventId ? `${origin}${eventsPath}/${encodeURIComponent(eventId)}` : "";
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

  return (
    <div
      className={isZaklyatie ? "event-page event-page--zaklyatie" : "event-page"}
      style={style}
    >
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

      {isZaklyatie && (
        <ZaklyatieAtmosphere
          fallbackSrc={curentEvent.photos?.[0] ? siteAsset(curentEvent.photos[0]) : undefined}
        />
      )}

      <div className="event-page__content">
        <Link to={eventsPath} className="events-page__back">
          Назад
        </Link>

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
          {isZaklyatie && <RainAmbienceToggle />}
        </div>

        <header className="event-page__header">
          <div className="event-page__hero">
            <GlitchHero as="h1" text={title} />
          </div>
          {subtitle && <p className="event-page__subtitle">{subtitle}</p>}


        </header>



        <div className="event-page__main">
          <section className="event-page__gallery" aria-label="Фотографии спектакля">
            <PhotoCarousel images={(curentEvent.photos ?? []).map(siteAsset)} title={title} />
          </section>



          <section className="event-page__text" aria-label="Описание спектакля">
            <div className="event-page__description">{curentEvent.anonse}</div>
            {isZaklyatie && (
              <section className="event-page__tickets" aria-label="Билеты">
                {ticketsCloudEventId && ticketsCloudToken ? (
                  <button
                    type="button"
                    className="event-page__ticketsButton"
                    data-tc-event={ticketsCloudEventId}
                    data-tc-token={ticketsCloudToken}
                  >
                    Купить билет
                  </button>
                ) : (
                  <div className="event-page__ticketsHint">
                    Добавь `REACT_APP_TC_ZAKLYATIE_EVENT_ID` и `REACT_APP_TC_ZAKLYATIE_TOKEN` в `.env`.
                  </div>
                )}
              </section>
            )}
          </section>

          {cast && cast.length > 0 && (
            <section className="event-page__cast" aria-label="Состав">
              <h2 className="event-page__sectionTitle">Состав</h2>
              <CastList items={cast} />
            </section>
          )}


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

type ZaklyatieAtmosphereProps = {
  fallbackSrc?: string;
};

type RainDrop = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  trail: number;
  wobble: number;
};

function ZaklyatieAtmosphere({ fallbackSrc }: ZaklyatieAtmosphereProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef<number>(0);
  const dropsRef = useRef<RainDrop[]>([]);
  // const [bgSrc, setBgSrc] = useState("https://i.pinimg.com/1200x/71/33/2e/71332e5fb4a472fa9dc27598f33855c5.jpg");
  const [bgSrc, setBgSrc] = useState("https://i.pinimg.com/1200x/f1/35/9b/f1359b0d0d57d5b89e1134113ebe8fd1.jpg");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const prefersReduced =
      typeof window !== "undefined" &&
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
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      // Re-init drops for new size (keep density stable)
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

        // Motion: gravity + slight wobble (wind)
        d.wobble += dt * (0.8 + d.r * 0.2);
        const wind = Math.sin(d.wobble) * 10;
        d.x += (d.vx + wind) * dt;
        d.y += d.vy * dt;

        // Wrap/reset
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

        // Trail
        const trailLen = d.trail * (0.75 + d.r * 0.06);
        const gx = ctx.createLinearGradient(d.x, d.y - trailLen, d.x, d.y);
        gx.addColorStop(0, "rgba(255,255,255,0)");
        gx.addColorStop(0.6, "rgba(255,255,255,0.08)");
        gx.addColorStop(1, "rgba(255,255,255,0.18)");
        ctx.strokeStyle = gx;
        ctx.lineWidth = Math.max(0.8, d.r * 0.55);
        ctx.beginPath();
        ctx.moveTo(d.x, d.y - trailLen);
        ctx.lineTo(d.x, d.y + d.r * 1.5);
        ctx.stroke();

        // Drop head
        const r = d.r * 2.1;
        const rg = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r);
        rg.addColorStop(0, "rgba(255,255,255,0.36)");
        rg.addColorStop(0.35, "rgba(255,255,255,0.16)");
        rg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, r * 0.62, r, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = window.requestAnimationFrame(draw);
    };

    setSize();
    window.addEventListener("resize", setSize);

    if (!prefersReduced) {
      rafRef.current = window.requestAnimationFrame(draw);
    } else {
      // One static frame (reduced motion)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = 2 + Math.random() * 5;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
        rg.addColorStop(0, "rgba(255,255,255,0.22)");
        rg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r * 2, 0, Math.PI * 2);
        ctx.fill();
      }
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

function RainAmbienceToggle() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const noiseSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const mediaElRef = useRef<HTMLAudioElement | null>(null);
  const mediaSrcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [isOn, setIsOn] = useState(false);

  // Use absolute URL or a public/ URL (e.g. "/audio/zaklyatie-rain.mp3")
  const rainUrl = "https://fyildiz1974.github.io/web/files/rain.mp3";

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
    if (!Ctx) return;

    const ctx: AudioContext = new Ctx();
    audioCtxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.18;
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

        const node = ctx.createMediaElementSource(el);
        node.connect(master);
        mediaElRef.current = el;
        mediaSrcRef.current = node;

        await el.play();
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
      className={isOn ? "event-page__chip zaklyatie-rain-toggle is-on" : "event-page__chip zaklyatie-rain-toggle"}
      aria-pressed={isOn}
      onClick={async () => {
        if (isOn) {
          stop();
          setIsOn(false);
          return;
        }
        await start();
        // Некоторые браузеры создают контекст в suspended — попробуем возобновить.
        if (audioCtxRef.current?.state === "suspended") {
          await audioCtxRef.current.resume().catch(() => { });
        }
        setIsOn(true);
      }}
    >
      Дождь: {isOn ? "вкл" : "выкл"}
    </button>
  );
}
