import { FC, useState } from "react";
import { Link } from "react-router-dom";
import Preloader from "../../shared/component/Preloader/Preloader";
import { Seo } from "../../shared/component/Seo/Seo";
import { siteAsset } from "../../shared/model/siteAssets";
import { ROUTES } from "../../shared/model/routes";
import { GlitchHero } from "../HomePage/GlitchHero";
import "../../shared/styles/site-bands-page.css";
import "./style.css";

type TeamMember = {
  id: number;
  name: string;
  img: string;
  role: "актер" | "актриса" | "худ. рук";
};

const items: TeamMember[] = [
  { id: 1, name: "Анастасия Рябых", img: "/actors/nastya.JPG", role: "актриса" },
  { id: 2, name: "Виктория Юркова", img: "/actors/vica-2.JPG", role: "актриса" },
  { id: 3, name: "Алексей Филатов", img: "/actors/lesha.jpg", role: "актер" },
  { id: 4, name: "Антон Васильев", img: "/actors/anton.jpg", role: "актер" },
  { id: 5, name: "Ксения", img: "/actors/ksysha-2.JPG", role: "актриса" },
  { id: 6, name: "Григорий Найдёнов", img: "/actors/grisha.jpg", role: "актер" },
  { id: 7, name: "Алена Паршина", img: "/actors/alena.JPG", role: "актриса" },
  { id: 8, name: "Екатерина Слыххановская", img: "/actors/katya.JPG", role: "актриса" },
  { id: 9, name: "Полина Смолкина", img: "/actors/polina.jpg", role: "актриса" },
  { id: 10, name: "Вероника Атушева", img: "/actors/nika.JPG", role: "актриса" },
  { id: 11, name: "Сергей Луняка", img: "/actors/ya.JPG", role: "худ. рук" },
  { id: 12, name: "Лера Буракова", img: "/actors/lera.jpg", role: "актриса" },
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
          <p className="site-bands-page__tagline">актеры и худ. рук</p>
        </header>

        <div className="site-bands-list" role="list" aria-label="Команда">
          {items.map((data) => (
            <TeamRow
              key={data.id}
              name={data.name}
              img={data.img}
              role={data.role}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export const Component = AboutUs;

function TeamRow({
  name,
  img,
  role,
}: {
  name: string;
  img: string;
  role: TeamMember["role"];
}) {
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
        <div className="aboutus-row__text">
          <span className="site-bands-row__title">{title}</span>
          <span className="aboutus-row__role">{role}</span>
        </div>
      </div>
    </div>
  );
}
