import { FC, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../../shared/model/routes";
import Preloader from "../../shared/component/Preloader/Preloader";
import "./style.css";

const items = [
  {
    id: 1,
    name: "Анастасия Рябых",
    social: "",
    img: "/actors/nastya.JPG",
  },
  {
    id: 2,
    name: "Виктория Юркова",
    social: "",
    img: "/actors/vica-2.JPG",
  },
  {
    id: 3,
    name: "Алексей Филатов",
    social: "",
    img: "/actors/lesha.jpg",
  },
  {
    id: 4,
    name: " Антон Васильев",
    social: "",
    img: "/actors/anton.jpg",
  },
  {
    id: 5,
    name: "Ксения",
    social: "",
    img: "/actors/ksysha-2.JPG",
  },
  {
    id: 6,
    name: "Григорий Найдёнов",
    social: "",
    img: "/actors/grisha.jpg",
  },
  {
    id: 7,
    name: "Алена Паршина",
    social: "",
    img: "/actors/alena.JPG",
  },
  {
    id: 8,
    name: "Еатерина Слыххановская",
    social: "",
    img: "/actors/katya.JPG",
  },
  {
    id: 9,
    name: "Полина Смолкина",
    social: "",
    img: "/actors/polina.jpg",
  },
  {
    id: 10,
    name: "Вероника Атушева",
    social: "",
    img: "/actors/nika.JPG",
  },
  {
    id: 11,
    name: "Сергей Луняка",
    social: "",
    img: "/actors/ya.JPG",
  },
  {
    id: 12,
    name: "Лера Буракова",
    social: "",
    img: "/actors/lera.jpg",
  },
];

const AboutUs: FC = () => {
  return (
    <div className="aboutus-page">
      <div className="aboutus-page__content">
        <Link to={ROUTES.HOME} className="events-page__back">
          Назад
        </Link>

        <header className="aboutus-page__header">
          <h1 className="aboutus-page__title">Команда</h1>
          <p className="aboutus-page__subtitle">Актёры и команда</p>
        </header>

        <div className="aboutus-grid" role="list" aria-label="Команда">
          {items.map((data) => (
            <Card key={data.id} data={data} />
          ))}
        </div>
      </div>
    </div>
  );
};

export const Component = AboutUs;

interface ICardProps {
  data: ICard;
}

interface ICard {
  name: string;
  img: string;
  social: string;
}

const Card: FC<ICardProps> = ({ data }) => {
  const { name, img } = data;
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="aboutus-card" role="listitem">
      {!isLoaded && (
        <div className="aboutus-card__loader" aria-hidden="true">
          <Preloader />
        </div>
      )}
      <img
        className={isLoaded ? "aboutus-card__img" : "aboutus-card__img aboutus-card__img--loading"}
        src={img}
        alt={name}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(true)}
      />
      <div className="aboutus-card__name">{name}</div>
    </div>
  );
};
