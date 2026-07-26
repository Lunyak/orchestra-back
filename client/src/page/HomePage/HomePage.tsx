import { FC, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Marquee } from "../../shared/component/Marquee/Marquee";
import { Seo } from "../../shared/component/Seo/Seo";
import { cn } from "../../shared/lib/cn";
import { ROUTES } from "../../shared/model/routes";
import { fetchSiteMarquee } from "../../shared/model/siteMarquee";
import { GlitchHero } from "./GlitchHero";
import { HomePlaybill } from "./HomePlaybill";
import "./style.css";

const ORKESTR_URL = "https://xn--80ahnpgc6b.xn--p1acf/orkestr/";

type TopNavItem = {
  key: string;
  label: string;
  badge?: string;
  to?: string;
  href?: string;
};

const TOP_NAV_ITEMS: TopNavItem[] = [
  {
    key: "team",
    label: "Команда",
    to: ROUTES.ABOUTUS,
  },
  {
    key: "contacts",
    label: "Контакты",
    to: ROUTES.CONTACTS,
  },
  {
    key: "theater",
    label: "3D холл",
    to: ROUTES.THEATER_WALK,
  },
];

const ORKESTR_NAV_ITEM: TopNavItem = {
  key: "orkestr",
  label: "Оркестр",
  badge: "SOFT",
  href: ORKESTR_URL,
};

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

  return (
    <div
      className="home-page"
      data-effects={effectsEnabled ? "on" : "off"}
      data-home-variant="bands"
    >
      <div className="home-page__grain" aria-hidden />

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

      <nav className="home-top-nav" aria-label="Разделы сайта">
        {TOP_NAV_ITEMS.map((item) => (
          <TopNavLink key={item.key} item={item} />
        ))}
      </nav>

      <div className="home-top-nav home-top-nav--right" aria-label="Оркестр">
        <TopNavLink item={ORKESTR_NAV_ITEM} />
        {homeAudioUrl.trim() && (
          <HomeAudioToggle url={homeAudioUrl.trim()} label={homeAudioLabel} />
        )}
      </div>

      <div className="home-page__container">

        <header className="home-page__hero-block">
          <GlitchHero
            text="Дофамин"
            as="h1"
            className="home-page__glitch-hero--home home-page__glitch-hero--bands"
          />
          <p className="home-page__tagline">театр в Санкт-Петербурге</p>
        </header>

        <HomePlaybill />

        <Marquee
          className="home-page__marquee"
          label="Новости и объявления"
          items={marqueeItems}
          duration={marqueeDuration}
        />
      </div>
    </div>
  );
};

export const Component = HomePage;

function TopNavLink({ item }: { item: TopNavItem }) {
  const className = cn(
    "home-top-nav__btn",
    item.badge && "home-top-nav__btn--soft"
  );

  const label = (
    <>
      {item.badge && <span className="home-top-nav__badge">{item.badge}</span>}
      <span>{item.label}</span>
    </>
  );

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {label}
      </a>
    );
  }

  return (
    <Link to={item.to ?? ROUTES.HOME} className={className}>
      {label}
    </Link>
  );
}

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
      className={cn("home-audio-toggle", isOn && "is-on")}
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
