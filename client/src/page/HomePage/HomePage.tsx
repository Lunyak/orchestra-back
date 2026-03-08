import { FC, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../../shared/model/routes";
import "./style.css";

const HomePage: FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);

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

  return (
    <div className="home-page">
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
            id="electricSwirl"
            colorInterpolationFilters="sRGB"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feTurbulence
              type="turbulence"
              baseFrequency="0.02"
              numOctaves="10"
              result="noise1a"
              seed="1"
            />
            <feOffset in="noise1a" dx="0" dy="0" result="offsetNoise1">
              <animate
                attributeName="dy"
                values="700; 0"
                dur="6s"
                repeatCount="indefinite"
                calcMode="linear"
              />
            </feOffset>

            <feTurbulence
              type="turbulence"
              baseFrequency="0.02"
              numOctaves="10"
              result="noise2a"
              seed="1"
            />
            <feOffset in="noise2a" dx="0" dy="0" result="offsetNoise2">
              <animate
                attributeName="dy"
                values="0; -700"
                dur="6s"
                repeatCount="indefinite"
                calcMode="linear"
              />
            </feOffset>

            <feTurbulence
              type="turbulence"
              baseFrequency="0.02"
              numOctaves="10"
              result="noise1b"
              seed="2"
            />
            <feOffset in="noise1b" dx="0" dy="0" result="offsetNoise3">
              <animate
                attributeName="dx"
                values="490; 0"
                dur="6s"
                repeatCount="indefinite"
                calcMode="linear"
              />
            </feOffset>

            <feTurbulence
              type="turbulence"
              baseFrequency="0.02"
              numOctaves="10"
              result="noise2b"
              seed="2"
            />
            <feOffset in="noise2b" dx="0" dy="0" result="offsetNoise4">
              <animate
                attributeName="dx"
                values="0; -490"
                dur="6s"
                repeatCount="indefinite"
                calcMode="linear"
              />
            </feOffset>

            <feComposite in="offsetNoise1" in2="offsetNoise2" result="part1" />
            <feComposite in="offsetNoise3" in2="offsetNoise4" result="part2" />
            <feBlend in="part1" in2="part2" mode="color-dodge" result="combinedNoise" />

            <feDisplacementMap
              in="SourceGraphic"
              in2="combinedNoise"
              scale="30"
              xChannelSelector="R"
              yChannelSelector="B"
            />
          </filter>

          <filter
            id="electricSwirlInner"
            colorInterpolationFilters="sRGB"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feTurbulence
              type="turbulence"
              baseFrequency="0.02"
              numOctaves="8"
              result="noise1a"
              seed="1"
            />
            <feOffset in="noise1a" dx="0" dy="0" result="offsetNoise1">
              <animate
                attributeName="dy"
                values="700; 0"
                dur="6s"
                repeatCount="indefinite"
                calcMode="linear"
              />
            </feOffset>

            <feTurbulence
              type="turbulence"
              baseFrequency="0.02"
              numOctaves="8"
              result="noise2a"
              seed="1"
            />
            <feOffset in="noise2a" dx="0" dy="0" result="offsetNoise2">
              <animate
                attributeName="dy"
                values="0; -700"
                dur="6s"
                repeatCount="indefinite"
                calcMode="linear"
              />
            </feOffset>

            <feComposite in="offsetNoise1" in2="offsetNoise2" result="combinedNoise" />

            <feDisplacementMap
              in="SourceGraphic"
              in2="combinedNoise"
              scale="12"
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
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="7" result="t1" />
            <feColorMatrix type="hueRotate" in="t1" result="pt1">
              <animate
                attributeName="values"
                values="0;360;"
                dur=".6s"
                repeatCount="indefinite"
                calcMode="paced"
              />
            </feColorMatrix>

            <feTurbulence
              type="turbulence"
              baseFrequency="0.03"
              numOctaves="7"
              seed="5"
              result="t2"
            />
            <feColorMatrix type="hueRotate" in="t2" result="pt2">
              <animate
                attributeName="values"
                values="0; 333; 199; 286; 64; 168; 256; 157; 360;"
                dur="5s"
                repeatCount="indefinite"
                calcMode="paced"
              />
            </feColorMatrix>

            <feBlend in="pt1" in2="pt2" mode="normal" result="combinedNoise" />

            <feDisplacementMap
              in="SourceGraphic"
              in2="combinedNoise"
              scale="30"
              xChannelSelector="R"
              yChannelSelector="B"
            />
          </filter>

          <filter
            id="electricHueInner"
            colorInterpolationFilters="sRGB"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="6" result="t1" />
            <feColorMatrix type="hueRotate" in="t1" result="pt1">
              <animate
                attributeName="values"
                values="0;360;"
                dur=".6s"
                repeatCount="indefinite"
                calcMode="paced"
              />
            </feColorMatrix>

            <feTurbulence
              type="turbulence"
              baseFrequency="0.03"
              numOctaves="6"
              seed="5"
              result="t2"
            />
            <feColorMatrix type="hueRotate" in="t2" result="pt2">
              <animate
                attributeName="values"
                values="0; 333; 199; 286; 64; 168; 256; 157; 360;"
                dur="5s"
                repeatCount="indefinite"
                calcMode="paced"
              />
            </feColorMatrix>

            <feBlend in="pt1" in2="pt2" mode="normal" result="combinedNoise" />

            <feDisplacementMap
              in="SourceGraphic"
              in2="combinedNoise"
              scale="12"
              xChannelSelector="R"
              yChannelSelector="B"
            />
          </filter>
        </defs>
      </svg>

      <div className="home-page__container">
        <div className="home-page__hero" aria-label="Дофамин. Театр. Спектакли.">
          <div className="home-page__morph-container">
            <div className="word-rotator">
              <div className="word">Дофамин</div>
              <div className="word">Театр</div>
              <div className="word">Оркестр</div>
            </div>
          </div>
        </div>

        <nav className="home-nav" aria-label="Навигация">
          <Link to={ROUTES.EVENTS} className="home-nav__card card-container" data-variant="swirl">
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

          <Link to={ROUTES.ABOUTUS} className="home-nav__card card-container" data-variant="swirl">
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
