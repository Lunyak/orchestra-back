import { FC, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Marquee } from "../../shared/component/Marquee/Marquee";
import { ROUTES } from "../../shared/model/routes";
import { GlitchHero } from "./GlitchHero";
import "./style.css";

type FilterTarget =
  | { variant: "swirl"; key: "events" | "team" }
  | { variant: "hue"; key: "orkestr" };

const HomePage: FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [effectsEnabled, setEffectsEnabled] = useState(false);

  const handleFirstInteraction = useCallback(() => {
    if (audioRef.current) {
      audioRef.current
        .play()
        .catch((e) => console.log("Audio play failed:", e));
      document.removeEventListener("click", handleFirstInteraction);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("click", handleFirstInteraction);
    handleFirstInteraction();
    return () => {
      document.removeEventListener("click", handleFirstInteraction);
    };
  }, [handleFirstInteraction]);

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
          items={[
            "Театр «Дофамин»",
            "Спектакли и даты",
            "Заклятие — билеты онлайн уже в продаже",
            "Приобрести можно на сайте https://ticketcloud.ru",
            "Иили на странице спектакля",

          ]}
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
