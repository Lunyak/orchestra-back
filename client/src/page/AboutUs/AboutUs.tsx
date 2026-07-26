import { FC, useState } from "react";
import { Link } from "react-router-dom";
import Preloader from "../../shared/component/Preloader/Preloader";
import { Seo } from "../../shared/component/Seo/Seo";
import { siteAsset } from "../../shared/model/siteAssets";
import { ROUTES } from "../../shared/model/routes";
import { GlitchHero } from "../HomePage/GlitchHero";
import "../../shared/styles/site-bands-page.css";
import "./style.css";

const items = [
  { id: 1, name: "Анастасия Рябых", img: "/actors/nastya.JPG" },
  { id: 2, name: "Виктория Юркова", img: "/actors/vica-2.JPG" },
  { id: 3, name: "Алексей Филатов", img: "/actors/lesha.jpg" },
  { id: 4, name: "Антон Васильев", img: "/actors/anton.jpg" },
  { id: 5, name: "Ксения", img: "/actors/ksysha-2.JPG" },
  { id: 6, name: "Григорий Найдёнов", img: "/actors/grisha.jpg" },
  { id: 7, name: "Алена Паршина", img: "/actors/alena.JPG" },
  { id: 8, name: "Екатерина Слыххановская", img: "/actors/katya.JPG" },
  { id: 9, name: "Полина Смолкина", img: "/actors/polina.jpg" },
  { id: 10, name: "Вероника Атушева", img: "/actors/nika.JPG" },
  { id: 11, name: "Сергей Луняка", img: "/actors/ya.JPG" },
  { id: 12, name: "Лера Буракова", img: "/actors/lera.jpg" },
];

const AboutUs: FC = () => {
  return (
    <div className="aboutus-page site-bands-page">
      <div className="site-bands-page__grain" aria-hidden />
      <Seo
        title="Команда — Театр «Дофамин»"
        description="Актёры и команда театра «Дофамин»."
        canonicalPath="/команда"
      />

      <Link to={ROUTES.HOME} className="site-bands-page__back">
        Назад
      </Link>

      <div className="site-bands-page__content">
        <header className="site-bands-page__hero">
          <GlitchHero
            as="h1"
            text="Команда"
            className="home-page__glitch-hero--page"
          />
          <p className="site-bands-page__tagline">актёры и команда</p>
        </header>

        <div className="site-bands-list" role="list" aria-label="Команда">
          {items.map((data) => (
            <TeamRow key={data.id} name={data.name} img={data.img} />
          ))}
        </div>
      </div>
    </div>
  );
};

export const Component = AboutUs;

function TeamRow({ name, img }: { name: string; img: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const title = name.trim();

  return (
    <div className="site-bands-row aboutus-row" role="listitem">
      <div className="site-bands-row__main">
        <div className="aboutus-row__avatar-wrap">
          {!isLoaded && (
            <div className="aboutus-row__loader" aria-hidden>
              <Preloader />
            </div>
          )}
          <img
            className="site-bands-row__avatar"
            data-loading={isLoaded ? undefined : "true"}
            src={siteAsset(img)}
            alt={title}
            loading="lazy"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={() => setIsLoaded(true)}
          />
        </div>
        <span className="site-bands-row__title">{title}</span>
      </div>
    </div>
  );
}
