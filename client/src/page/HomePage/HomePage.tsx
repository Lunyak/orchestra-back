import { FC, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Marquee } from "../../shared/component/Marquee/Marquee";
import { Seo } from "../../shared/component/Seo/Seo";
import { ROUTES } from "../../shared/model/routes";
import { fetchSiteMarquee } from "../../shared/model/siteMarquee";
import { GlitchHero } from "./GlitchHero";
import "./style.css";

type FilterTarget =
  | { variant: "swirl"; key: "events" | "team" }
  | { variant: "hue"; key: "orkestr" };

const HomePage: FC = () => {
  const [effectsEnabled, setEffectsEnabled] = useState(false);
  const [marqueeItems, setMarqueeItems] = useState<string[]>([
    "Театр «Дофамин»",
    "Спектакли и даты",
    "Заклятие — билеты онлайн уже в продаже",
    "Приобрести можно на сайте https://ticketcloud.ru",
    "Иили на странице спектакля",
  ]);
  const [marqueeDuration, setMarqueeDuration] = useState<number>(22);
  const [homeAudioUrl, setHomeAudioUrl] = useState<string>("");
  const [homeAudioLabel, setHomeAudioLabel] = useState<string>("Звук");

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => {
      setEffectsEnabled(!reduceMotion.matches);
    };

    update();
    reduceMotion.addEventListener("change", update);
    return () => {
      reduceMotion.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchSiteMarquee()
      .then((remote) => {
        if (!alive) return;
        if (remote?.items?.length) setMarqueeItems(remote.items);
        if (typeof remote?.duration === "number" && Number.isFinite(remote.duration) && remote.duration > 3) {
          setMarqueeDuration(remote.duration);
        }
        if (typeof remote?.homeAudioUrl === "string") setHomeAudioUrl(remote.homeAudioUrl);
        if (typeof remote?.homeAudioLabel === "string" && remote.homeAudioLabel.trim()) {
          setHomeAudioLabel(remote.homeAudioLabel.trim());
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const startFilterAnimation = useCallback(
    ({ variant, key }: FilterTarget) => {
      if (!effectsEnabled) return;

      const ids =
        variant === "swirl"
          ? [`hp-swirl-dx-${key}`, `hp-swirl-dy-${key}`]
          : [`hp-hue-rotate-${key}`, `hp-hue-dx-${key}`];

      for (const id of ids) {
        const el = document.getElementById(id) as SVGAnimationElement | null;
        el?.beginElement?.();
      }
    },
    [effectsEnabled]
  );

  const stopFilterAnimation = useCallback(
    ({ variant, key }: FilterTarget) => {
      if (!effectsEnabled) return;

      const ids =
        variant === "swirl"
          ? [`hp-swirl-dx-${key}`, `hp-swirl-dy-${key}`]
          : [`hp-hue-rotate-${key}`, `hp-hue-dx-${key}`];

      for (const id of ids) {
        const el = document.getElementById(id) as SVGAnimationElement | null;
        el?.endElement?.();
      }
    },
    [effectsEnabled]
  );

  return (
    <div className="home-page" data-effects={effectsEnabled ? "on" : "off"}>
      <Seo
        title="Дофамин — театр в Санкт-Петербурге"
        description="Театр «Дофамин» в Санкт-Петербурге: спектакли (комедия, драма, трагедия), афиша и билеты онлайн."
        canonicalPath="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "TheaterGroup",
            name: "Театр «Дофамин»",
            url: typeof window !== "undefined" ? window.location.origin : undefined,
            sameAs: ["https://vk.com/dofaminspb", "https://t.me/dofamintheatre"],
            address: {
              "@type": "PostalAddress",
              addressLocality: "Санкт-Петербург",
              addressCountry: "RU",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Театр «Дофамин»",
            url: typeof window !== "undefined" ? window.location.origin : undefined,
            inLanguage: "ru-RU",
          },
        ]}
      />
      {effectsEnabled && (
        <svg className="home-page__filters" aria-hidden>
          <defs>
            <filter id="threshold">
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 255 -140"
              />
            </filter>

            <filter
              id="electricSwirlEvents"
              colorInterpolationFilters="sRGB"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feTurbulence type="turbulence" baseFrequency="0.015" numOctaves="2" seed="2" result="noise" />
              <feOffset in="noise" dx="0" dy="0" result="noiseOffset">
                <animate
                  id="hp-swirl-dy-events"
                  attributeName="dy"
                  values="0; 700"
                  dur="6s"
                  repeatCount="indefinite"
                  begin="indefinite"
                  calcMode="linear"
                />
                <animate
                  id="hp-swirl-dx-events"
                  attributeName="dx"
                  values="0; -490"
                  dur="6s"
                  repeatCount="indefinite"
                  begin="indefinite"
                  calcMode="linear"
                />
              </feOffset>
              <feDisplacementMap
                in="SourceGraphic"
                in2="noiseOffset"
                scale="22"
                xChannelSelector="R"
                yChannelSelector="B"
              />
            </filter>

            <filter
              id="electricSwirlTeam"
              colorInterpolationFilters="sRGB"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feTurbulence type="turbulence" baseFrequency="0.015" numOctaves="2" seed="2" result="noise" />
              <feOffset in="noise" dx="0" dy="0" result="noiseOffset">
                <animate
                  id="hp-swirl-dy-team"
                  attributeName="dy"
                  values="0; 700"
                  dur="6s"
                  repeatCount="indefinite"
                  begin="indefinite"
                  calcMode="linear"
                />
                <animate
                  id="hp-swirl-dx-team"
                  attributeName="dx"
                  values="0; -490"
                  dur="6s"
                  repeatCount="indefinite"
                  begin="indefinite"
                  calcMode="linear"
                />
              </feOffset>
              <feDisplacementMap
                in="SourceGraphic"
                in2="noiseOffset"
                scale="22"
                xChannelSelector="R"
                yChannelSelector="B"
              />
            </filter>

            <filter
              id="electricHue"
              colorInterpolationFilters="sRGB"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="2" seed="5" result="noise" />
              <feOffset in="noise" dx="0" dy="0" result="noiseOffset">
                <animate
                  id="hp-hue-dx-orkestr"
                  attributeName="dx"
                  values="0; 240"
                  dur="4s"
                  repeatCount="indefinite"
                  begin="indefinite"
                  calcMode="linear"
                />
              </feOffset>
              <feColorMatrix in="noiseOffset" type="hueRotate" values="140" result="hueNoise">
                <animate
                  id="hp-hue-rotate-orkestr"
                  attributeName="values"
                  values="140; 360; 140"
                  dur="2.2s"
                  repeatCount="indefinite"
                  begin="indefinite"
                  calcMode="paced"
                />
              </feColorMatrix>
              <feDisplacementMap
                in="SourceGraphic"
                in2="hueNoise"
                scale="22"
                xChannelSelector="R"
                yChannelSelector="B"
              />
            </filter>
          </defs>
        </svg>
      )}

      <div className="home-page__container">
        {homeAudioUrl.trim() && (
          <div className="home-page__toggles">
            <HomeAudioToggle url={homeAudioUrl.trim()} label={homeAudioLabel} />
          </div>
        )}

        {/* <div className="home-page__hero" aria-label="Дофамин. Театр. Спектакли.">
          <div className="home-page__morph-container">
            <div className="word-rotator">
              <div className="word">Дофамин</div>
              <div className="word">Театр</div>
              <div className="word">Оркестр</div>
            </div>
          </div>
        </div> */}

        <GlitchHero text="Дофамин" className="home-page__glitch-hero--home" />

        <nav className="home-nav" aria-label="Навигация">
          <Link
            to={ROUTES.EVENTS}
            className="home-nav__card card-container"
            data-variant="swirl"
            data-filter="events"
            onMouseEnter={() => startFilterAnimation({ variant: "swirl", key: "events" })}
            onMouseLeave={() => stopFilterAnimation({ variant: "swirl", key: "events" })}
            onFocus={() => startFilterAnimation({ variant: "swirl", key: "events" })}
            onBlur={() => stopFilterAnimation({ variant: "swirl", key: "events" })}
          >
            <div className="inner-container" aria-hidden>
              <div className="border-outer">
                <div className="main-card" />
              </div>
              <div className="glow-layer-1" />
              <div className="glow-layer-2" />
            </div>

            <div className="overlay-1" aria-hidden />
            <div className="overlay-2" aria-hidden />
            <div className="background-glow" aria-hidden />

            <div className="content-container">
              <div className="content-top">

                <p className="title">Спектакли</p>
              </div>

              <hr className="divider" />

              <div className="content-bottom">
                <p className="description">Афиша и даты</p>
              </div>
            </div>
          </Link>

          <a
            href="https://xn--80ahnpgc6b.xn--p1acf/orkestr/"
            target="_blank"
            rel="noopener noreferrer"
            className="home-nav__card card-container"
            data-variant="hue"
            data-filter="orkestr"
            onMouseEnter={() => startFilterAnimation({ variant: "hue", key: "orkestr" })}
            onMouseLeave={() => stopFilterAnimation({ variant: "hue", key: "orkestr" })}
            onFocus={() => startFilterAnimation({ variant: "hue", key: "orkestr" })}
            onBlur={() => stopFilterAnimation({ variant: "hue", key: "orkestr" })}
          >
            <div className="inner-container" aria-hidden>
              <div className="border-outer">
                <div className="main-card" />
              </div>
              <div className="glow-layer-1" />
              <div className="glow-layer-2" />
            </div>

            <div className="overlay-1" aria-hidden />
            <div className="overlay-2" aria-hidden />
            <div className="background-glow" aria-hidden />

            <div className="content-container">
              <div className="content-top">
                <div className="scrollbar-glass">SOFT</div>
                <p className="title">Оркестр</p>
              </div>

              <hr className="divider" />

              <div className="content-bottom">
                <p className="description">WEB-приложение для работы над спектаклем и ролью</p>
              </div>
            </div>
          </a>

          <Link
            to={ROUTES.ABOUTUS}
            className="home-nav__card card-container"
            data-variant="swirl"
            data-filter="team"
            onMouseEnter={() => startFilterAnimation({ variant: "swirl", key: "team" })}
            onMouseLeave={() => stopFilterAnimation({ variant: "swirl", key: "team" })}
            onFocus={() => startFilterAnimation({ variant: "swirl", key: "team" })}
            onBlur={() => stopFilterAnimation({ variant: "swirl", key: "team" })}
          >
            <div className="inner-container" aria-hidden>
              <div className="border-outer">
                <div className="main-card" />
              </div>
              <div className="glow-layer-1" />
              <div className="glow-layer-2" />
            </div>

            <div className="overlay-1" aria-hidden />
            <div className="overlay-2" aria-hidden />
            <div className="background-glow" aria-hidden />

            <div className="content-container">
              <div className="content-top">
                {/* <div className="scrollbar-glass">Dramatic</div> */}
                <p className="title">Команда</p>
              </div>

              <hr className="divider" />

              <div className="content-bottom">
                <p className="description">Актёры и команда</p>
              </div>
            </div>
          </Link>
        </nav>

        <Marquee
          className="home-page__marquee"
          label="Новости и объявления"
          items={marqueeItems}
          duration={marqueeDuration}
        />

        <div className="home-nav__contacts">
          <Link to={ROUTES.CONTACTS} className="home-nav__contacts-link">
            Контакты
          </Link>
        </div>
      </div>
    </div>
  );
};

export const Component = HomePage;

function HomeAudioToggle({ url, label }: { url: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startingRef = useRef(false);
  const [isOn, setIsOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const stop = () => {
    try {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
    } catch {
      // ignore
    }
    if (audioRef.current) {
      audioRef.current.src = "";
    }
    audioRef.current = null;
  };

  const start = async () => {
    stop();
    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.src = url;
    el.loop = true;
    el.preload = "auto";
    el.volume = 0.18;
    audioRef.current = el;
    await el.play();
  };

  useEffect(() => {
    return () => stop();
  }, []);

  return (
    <button
      type="button"
      className={isOn ? "home-audio-toggle is-on" : "home-audio-toggle"}
      aria-pressed={isOn}
      disabled={isLoading}
      aria-busy={isLoading}
      onClick={async () => {
        if (startingRef.current || isLoading) return;

        if (isOn) {
          stop();
          setIsOn(false);
          return;
        }

        startingRef.current = true;
        setIsLoading(true);
        try {
          await start();
          setIsOn(true);
        } catch {
          stop();
          setIsOn(false);
        } finally {
          startingRef.current = false;
          setIsLoading(false);
        }
      }}
    >
      {label || "Звук"}: {isLoading ? "…" : isOn ? "вкл" : "выкл"}
    </button>
  );
}
