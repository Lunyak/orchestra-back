import { FC } from "react";
import { useLocation } from "react-router-dom";
import { Seo } from "../../shared/component/Seo/Seo";
import { HomeChalkBoard } from "./HomeChalkBoard";
import "./style.css";

const HomePage: FC = () => {
  const { pathname } = useLocation();
  const showSeo = pathname === "/";

  return (
    <div className="home-page home-page--chalk">
      {showSeo && (
      <Seo
        title="Дофамин — театр в Санкт-Петербурге"
        description="Театр «Дофамин» в Санкт-Петербурге: спектакли, афиша и билеты онлайн."
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
      )}

      <HomeChalkBoard />
    </div>
  );
};

export const Component = HomePage;
